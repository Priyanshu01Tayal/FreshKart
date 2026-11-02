import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { NavTab } from './components/layout/Sidebar';
import { Login } from './pages/Login';
import { DashboardOverview } from './pages/DashboardOverview';
import { LiveOrders } from './pages/LiveOrders';
import { Products } from './pages/Products';
import { Categories } from './pages/Categories';
import { Inventory } from './pages/Inventory';
import { StoreControls } from './pages/StoreControls';
import { DeliveryPartners } from './pages/DeliveryPartners';
import { CashReconciliation } from './pages/CashReconciliation';
import { SalesReports } from './pages/SalesReports';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { orderChime } from './utils/audio';
import type { Database, OrderStatus } from '@freshkart/shared';

type Order = Database['public']['Tables']['orders']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type StoreSettings = Database['public']['Tables']['store_settings']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];
type CashSettlement = Database['public']['Tables']['cash_settlements']['Row'];

const DashboardContent: React.FC = () => {
  const { isAdmin, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('orders');

  // Genuine Database States (no mock data fallback in production)
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [deliveryPartners, setDeliveryPartners] = useState<Profile[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [settlements, setSettlements] = useState<CashSettlement[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStoreLoading, setIsStoreLoading] = useState<boolean>(false);

  // Fetch Database Data from real Supabase instance
  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [
        ordersRes,
        productsRes,
        categoriesRes,
        settingsRes,
        partnersRes,
        settlementsRes,
        itemsRes,
      ] = await Promise.all([
        supabase.from('orders').select('*').order('placed_at', { ascending: false }),
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('store_settings').select('*').limit(1).maybeSingle(),
        supabase.from('profiles').select('*').eq('role', 'delivery_partner'),
        supabase.from('cash_settlements').select('*').order('settled_at', { ascending: false }),
        supabase.from('order_items').select('*'),
      ]);

      if (ordersRes.data) setOrders(ordersRes.data as unknown as Order[]);
      if (productsRes.data) setProducts(productsRes.data as unknown as Product[]);
      if (categoriesRes.data) setCategories(categoriesRes.data as unknown as Category[]);
      if (settingsRes.data) setStoreSettings(settingsRes.data as unknown as StoreSettings);
      if (partnersRes.data) setDeliveryPartners(partnersRes.data as unknown as Profile[]);
      if (settlementsRes.data) setSettlements(settlementsRes.data as unknown as CashSettlement[]);

      if (itemsRes.data) {
        const itemMap: Record<string, OrderItem[]> = {};
        (itemsRes.data as unknown as OrderItem[]).forEach((it) => {
          if (!itemMap[it.order_id]) itemMap[it.order_id] = [];
          itemMap[it.order_id].push(it);
        });
        setOrderItems(itemMap);
      }
    } catch (err) {
      console.error('Error fetching dashboard data from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    fetchData();

    if (!isSupabaseConfigured) return;

    // Realtime channel for live incoming orders
    const ordersChannel = supabase
      .channel('admin_realtime_orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new as Order;
          setOrders((prev) => [newOrder, ...prev]);
          orderChime.playNewOrderChime();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        }
      )
      .subscribe();

    // Realtime channel for product stock changes
    const productChannel = supabase
      .channel('admin_realtime_products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProducts((prev) => [payload.new as Product, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Product;
            setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          } else if (payload.eventType === 'DELETE') {
            setProducts((prev) => prev.filter((p) => p.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(productChannel);
    };
  }, [isAdmin, fetchData]);

  // Master Store Status Toggle
  const handleToggleStoreOpen = async () => {
    if (!storeSettings) return;
    setIsStoreLoading(true);
    const newStatus = !storeSettings.is_store_open;
    try {
      if (isSupabaseConfigured) {
        const { error } = await (supabase.from('store_settings') as any)
          .update({ is_store_open: newStatus })
          .eq('id', storeSettings.id);
        if (error) throw error;
      }
      setStoreSettings((prev) => (prev ? { ...prev, is_store_open: newStatus } : prev));
    } catch (err) {
      console.error('Failed to toggle store status in database:', err);
    } finally {
      setIsStoreLoading(false);
    }
  };

  // Order Status Handler
  const handleUpdateStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    deliveryPartnerId?: string,
    cancelReason?: string
  ) => {
    const updates: Partial<Order> = { status: newStatus };
    if (deliveryPartnerId !== undefined) {
      updates.delivery_partner_id = deliveryPartnerId;
    }
    if (cancelReason) {
      updates.cancellation_reason = cancelReason;
      updates.cancelled_by = 'admin';
    }

    if (isSupabaseConfigured) {
      const { error } = await (supabase.from('orders') as any).update(updates).eq('id', orderId);
      if (error) throw error;
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o))
    );
  };

  // Product CRUD Handlers
  const handleCreateProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    if (isSupabaseConfigured) {
      const { data, error } = await (supabase.from('products') as any).insert([productData]).select().single();
      if (error) throw error;
      if (data) setProducts((prev) => [data as unknown as Product, ...prev]);
    }
  };

  const handleUpdateProduct = async (productId: string, updates: Partial<Product>) => {
    if (isSupabaseConfigured) {
      const { error } = await (supabase.from('products') as any).update(updates).eq('id', productId);
      if (error) throw error;
    }
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...updates } : p)));
  };

  const handleDeleteProduct = async (productId: string) => {
    if (isSupabaseConfigured) {
      const { error } = await (supabase.from('products') as any).delete().eq('id', productId);
      if (error) throw error;
    }
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  // Category CRUD Handlers
  const handleCreateCategory = async (catData: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => {
    if (isSupabaseConfigured) {
      const { data, error } = await (supabase.from('categories') as any).insert([catData]).select().single();
      if (error) throw error;
      if (data) setCategories((prev) => [...prev, data as unknown as Category]);
    }
  };

  const handleUpdateCategory = async (id: string, updates: Partial<Category>) => {
    if (isSupabaseConfigured) {
      const { error } = await (supabase.from('categories') as any).update(updates).eq('id', id);
      if (error) throw error;
    }
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleDeleteCategory = async (id: string) => {
    if (isSupabaseConfigured) {
      const { error } = await (supabase.from('categories') as any).delete().eq('id', id);
      if (error) throw error;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  // Stock Quick-Update Handler
  const handleUpdateStock = async (productId: string, newStock: number) => {
    await handleUpdateProduct(productId, { stock_quantity: newStock });
  };

  // Store Controls Update Handler
  const handleUpdateSettings = async (updates: Partial<StoreSettings>) => {
    if (!storeSettings) return;
    if (isSupabaseConfigured) {
      const { error } = await (supabase.from('store_settings') as any).update(updates).eq('id', storeSettings.id);
      if (error) throw error;
    }
    setStoreSettings((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  // Delivery Partner Active Toggle & Add
  const handleTogglePartnerActive = async (partnerId: string, isActive: boolean) => {
    if (isSupabaseConfigured) {
      const { error } = await (supabase.from('profiles') as any).update({ is_active: isActive }).eq('id', partnerId);
      if (error) throw error;
    }
    setDeliveryPartners((prev) =>
      prev.map((dp) => (dp.id === partnerId ? { ...dp, is_active: isActive } : dp))
    );
  };

  const handleAddPartner = async (fullName: string, phone: string) => {
    if (isSupabaseConfigured) {
      const { data, error } = await (supabase.from('profiles') as any)
        .insert([{ full_name: fullName, phone_number: phone, role: 'delivery_partner', is_active: true }])
        .select()
        .single();
      if (error) throw error;
      if (data) setDeliveryPartners((prev) => [...prev, data as unknown as Profile]);
    }
  };

  // Cash Reconciliation Handler
  const handleExecuteSettlement = async (partnerId: string, actualCash: number, notes?: string) => {
    if (isSupabaseConfigured) {
      const { error } = await (supabase.rpc as any)('settle_delivery_partner_cash', {
        p_delivery_partner_id: partnerId,
        p_actual_cash_received: actualCash,
        p_notes: notes || null,
      });
      if (error) throw error;
      await fetchData();
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5FAF5]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#168447] border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Login />;
  }

  const pendingOrdersCount = orders.filter(
    (o) => o.status === 'PLACED' || o.status === 'CONFIRMED'
  ).length;

  const lowStockCount = products.filter(
    (p) => p.is_active && p.stock_quantity <= p.low_stock_threshold
  ).length;

  return (
    <AdminLayout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      pendingOrdersCount={pendingOrdersCount}
      lowStockCount={lowStockCount}
      isStoreOpen={storeSettings?.is_store_open ?? true}
      onToggleStoreOpen={handleToggleStoreOpen}
      isStoreLoading={isStoreLoading}
    >
      {activeTab === 'dashboard' && (
        <DashboardOverview
          orders={orders}
          products={products}
          isLoading={isLoading}
          onNavigateToOrders={() => setActiveTab('orders')}
          onNavigateToInventory={() => setActiveTab('inventory')}
        />
      )}

      {activeTab === 'orders' && (
        <LiveOrders
          orders={orders}
          deliveryPartners={deliveryPartners}
          orderItems={orderItems}
          onUpdateStatus={handleUpdateStatus}
          isLoading={isLoading}
        />
      )}

      {activeTab === 'products' && (
        <Products
          products={products}
          categories={categories}
          onCreateProduct={handleCreateProduct}
          onUpdateProduct={handleUpdateProduct}
          onDeleteProduct={handleDeleteProduct}
          isLoading={isLoading}
        />
      )}

      {activeTab === 'categories' && (
        <Categories
          categories={categories}
          products={products}
          onCreateCategory={handleCreateCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          isLoading={isLoading}
        />
      )}

      {activeTab === 'inventory' && (
        <Inventory
          products={products}
          categories={categories}
          onUpdateStock={handleUpdateStock}
          isLoading={isLoading}
        />
      )}

      {activeTab === 'store-settings' && (
        <StoreControls
          settings={storeSettings}
          onUpdateSettings={handleUpdateSettings}
          isLoading={isLoading}
        />
      )}

      {activeTab === 'delivery' && (
        <DeliveryPartners
          deliveryPartners={deliveryPartners}
          orders={orders}
          onToggleActive={handleTogglePartnerActive}
          onAddPartner={handleAddPartner}
          isLoading={isLoading}
        />
      )}

      {activeTab === 'reconciliation' && (
        <CashReconciliation
          deliveryPartners={deliveryPartners}
          orders={orders}
          settlements={settlements}
          onExecuteSettlement={handleExecuteSettlement}
          isLoading={isLoading}
        />
      )}

      {activeTab === 'reports' && (
        <SalesReports
          orders={orders}
          products={products}
          orderItems={orderItems}
          isLoading={isLoading}
        />
      )}
    </AdminLayout>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
};

export default App;
