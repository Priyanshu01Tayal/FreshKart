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

// Initial Fallback Seed for offline testing
const INITIAL_STORE_SETTINGS: StoreSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  singleton_guard: true,
  store_name: 'FreshKart Central Hub - Koramangala',
  store_address: '124, 80 Feet Road, 4th Block, Koramangala, Bengaluru, Karnataka 560034',
  latitude: 12.9345330,
  longitude: 77.6265790,
  delivery_radius_km: 5.0,
  is_store_open: true,
  is_delivery_available: true,
  min_order_value: 99.0,
  standard_delivery_fee: 25.0,
  free_delivery_threshold: 299.0,
  contact_phone: '+919876543210',
  updated_at: new Date().toISOString(),
  updated_by: null,
};

const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Fresh Vegetables', slug: 'fresh-vegetables', image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300', sort_order: 1, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-2', name: 'Fresh Fruits', slug: 'fresh-fruits', image_url: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=300', sort_order: 2, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-3', name: 'Dairy & Breakfast', slug: 'dairy-breakfast', image_url: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=300', sort_order: 3, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-4', name: 'Bakery & Bread', slug: 'bakery-bread', image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300', sort_order: 4, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-5', name: 'Snacks & Munchies', slug: 'snacks-munchies', image_url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300', sort_order: 5, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-6', name: 'Cold Drinks & Juices', slug: 'cold-drinks-juices', image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=300', sort_order: 6, is_active: true, created_at: '', updated_at: '' },
];

const INITIAL_PRODUCTS: Product[] = [
  { id: 'p-1', category_id: 'cat-1', name: 'Fresh Hybrid Tomatoes', description: 'Farm fresh red tomatoes', unit: '500g', price: 24.0, discount_price: 19.0, image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400', stock_quantity: 45, low_stock_threshold: 10, is_active: true, created_at: '', updated_at: '' },
  { id: 'p-2', category_id: 'cat-1', name: 'Fresh Pink Onions', description: 'Crisp, pungent onions', unit: '1 kg', price: 38.0, discount_price: 32.0, image_url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400', stock_quantity: 4, low_stock_threshold: 10, is_active: true, created_at: '', updated_at: '' },
  { id: 'p-3', category_id: 'cat-3', name: 'Amul Taaza Milk', description: 'Pasteurised fresh toned milk', unit: '1 L', price: 54.0, discount_price: 52.0, image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400', stock_quantity: 0, low_stock_threshold: 8, is_active: true, created_at: '', updated_at: '' },
  { id: 'p-4', category_id: 'cat-4', name: 'English Oven Wheat Bread', description: '100% whole wheat sliced bread', unit: '400g', price: 50.0, discount_price: 45.0, image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', stock_quantity: 12, low_stock_threshold: 5, is_active: true, created_at: '', updated_at: '' },
  { id: 'p-5', category_id: 'cat-5', name: 'Lay\'s India\'s Magic Masala', description: 'Spicy potato chips', unit: '50g', price: 20.0, discount_price: null, image_url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400', stock_quantity: 35, low_stock_threshold: 10, is_active: true, created_at: '', updated_at: '' },
];

const INITIAL_RIDERS: Profile[] = [
  { id: 'rider-1', full_name: 'Rahul Kumar', phone_number: '+919876500001', role: 'delivery_partner', is_active: true, created_at: '', updated_at: '' },
  { id: 'rider-2', full_name: 'Suresh Patel', phone_number: '+919876500002', role: 'delivery_partner', is_active: true, created_at: '', updated_at: '' },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-101',
    order_number: 'FK-20261102-1084',
    customer_id: 'cust-1',
    delivery_partner_id: null,
    status: 'PLACED',
    payment_method: 'COD',
    cod_status: 'PENDING_COLLECTION',
    subtotal: 156.0,
    delivery_fee: 25.0,
    total_amount: 181.0,
    cod_collected_amount: null,
    cod_collected_at: null,
    cash_settlement_id: null,
    delivery_address: {
      recipient_name: 'Ananya Roy',
      phone: '+919811223344',
      address_line1: 'Flat 402, Green Glen Layout, Bellandur',
      landmark: 'Near Central Mall',
      distance_km: 2.4,
    },
    customer_notes: 'Please do not ring bell, leave at door.',
    cancellation_reason: null,
    cancelled_by: null,
    placed_at: new Date().toISOString(),
    confirmed_at: null,
    packed_at: null,
    dispatched_at: null,
    delivered_at: null,
    cancelled_at: null,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ord-102',
    order_number: 'FK-20261102-1082',
    customer_id: 'cust-2',
    delivery_partner_id: 'rider-1',
    status: 'DELIVERED',
    payment_method: 'COD',
    cod_status: 'HELD_BY_PARTNER',
    subtotal: 310.0,
    delivery_fee: 0.0,
    total_amount: 310.0,
    cod_collected_amount: 310.0,
    cod_collected_at: new Date(Date.now() - 3600000).toISOString(),
    cash_settlement_id: null,
    delivery_address: {
      recipient_name: 'Karthik Rao',
      phone: '+919844556677',
      address_line1: '14, 5th Cross, 6th Block, Koramangala',
      landmark: 'Opposite Police Station',
      distance_km: 1.1,
    },
    customer_notes: null,
    cancellation_reason: null,
    cancelled_by: null,
    placed_at: new Date(Date.now() - 5400000).toISOString(),
    confirmed_at: new Date(Date.now() - 4800000).toISOString(),
    packed_at: new Date(Date.now() - 4200000).toISOString(),
    dispatched_at: new Date(Date.now() - 3900000).toISOString(),
    delivered_at: new Date(Date.now() - 3600000).toISOString(),
    cancelled_at: null,
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_ORDER_ITEMS: Record<string, OrderItem[]> = {
  'ord-101': [
    { id: 'it-1', order_id: 'ord-101', product_id: 'p-1', product_name: 'Fresh Hybrid Tomatoes', unit: '500g', unit_price: 19.0, quantity: 2, total_price: 38.0 },
    { id: 'it-2', order_id: 'ord-101', product_id: 'p-2', product_name: 'Fresh Pink Onions', unit: '1 kg', unit_price: 32.0, quantity: 2, total_price: 64.0 },
    { id: 'it-3', order_id: 'ord-101', product_id: 'p-4', product_name: 'English Oven Wheat Bread', unit: '400g', unit_price: 45.0, quantity: 1, total_price: 45.0 },
  ],
  'ord-102': [
    { id: 'it-4', order_id: 'ord-102', product_id: 'p-1', product_name: 'Fresh Hybrid Tomatoes', unit: '500g', unit_price: 19.0, quantity: 4, total_price: 76.0 },
    { id: 'it-5', order_id: 'ord-102', product_id: 'p-4', product_name: 'English Oven Wheat Bread', unit: '400g', unit_price: 45.0, quantity: 2, total_price: 90.0 },
  ],
};

const DashboardContent: React.FC = () => {
  const { isAdmin, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('orders');

  // Application Data States
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(INITIAL_STORE_SETTINGS);
  const [deliveryPartners, setDeliveryPartners] = useState<Profile[]>(INITIAL_RIDERS);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>(INITIAL_ORDER_ITEMS);
  const [settlements, setSettlements] = useState<CashSettlement[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStoreLoading, setIsStoreLoading] = useState<boolean>(false);

  // Fetch Database Data or Fallback
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }

      // Fetch in parallel
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
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (!isSupabaseConfigured) return;

    // Realtime channel for live orders
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
  }, [fetchData]);

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
      console.error('Failed to toggle store status:', err);
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
      prev.map((o) => {
        if (o.id === orderId) {
          const updated = { ...o, ...updates };
          // If cancelled in local state, simulate restock
          if (newStatus === 'CANCELLED' && o.status !== 'CANCELLED') {
            const items = orderItems[orderId] || [];
            items.forEach((it) => {
              setProducts((currProds) =>
                currProds.map((p) =>
                  p.id === it.product_id ? { ...p, stock_quantity: p.stock_quantity + it.quantity } : p
                )
              );
            });
          }
          return updated;
        }
        return o;
      })
    );
  };

  // Product CRUD Handlers
  const handleCreateProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    if (isSupabaseConfigured) {
      const { data, error } = await (supabase.from('products') as any).insert([productData]).select().single();
      if (error) throw error;
      if (data) setProducts((prev) => [data as unknown as Product, ...prev]);
    } else {
      const mockProduct: Product = {
        ...productData,
        id: 'p-' + Math.random().toString(36).substring(2, 8),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProducts((prev) => [mockProduct, ...prev]);
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
    } else {
      const mockCategory: Category = {
        ...catData,
        id: 'cat-' + Math.random().toString(36).substring(2, 8),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCategories((prev) => [...prev, mockCategory]);
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
    const mockId = 'rider-' + Math.random().toString(36).substring(2, 7);
    const newPartner: Profile = {
      id: mockId,
      full_name: fullName,
      phone_number: phone,
      role: 'delivery_partner',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured) {
      const { error } = await (supabase.from('profiles') as any).insert([newPartner]);
      if (error) throw error;
    }
    setDeliveryPartners((prev) => [...prev, newPartner]);
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
    } else {
      // Local settlement simulation
      const deliveredPending = orders.filter(
        (o) =>
          o.delivery_partner_id === partnerId &&
          o.status === 'DELIVERED' &&
          o.cod_status === 'HELD_BY_PARTNER'
      );
      const expected = deliveredPending.reduce((sum, o) => sum + Number(o.total_amount), 0);
      const settlementId = 'settle-' + Math.random().toString(36).substring(2, 8);
      const newSettlement: CashSettlement = {
        id: settlementId,
        settlement_reference: 'SETTLE-20261102-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        delivery_partner_id: partnerId,
        admin_id: 'admin-id',
        total_orders_settled: deliveredPending.length,
        expected_cash_amount: expected,
        actual_cash_received: actualCash,
        discrepancy_amount: actualCash - expected,
        discrepancy_notes: notes || null,
        settled_at: new Date().toISOString(),
      };
      setSettlements((prev) => [newSettlement, ...prev]);
      setOrders((prev) =>
        prev.map((o) =>
          o.delivery_partner_id === partnerId && o.status === 'DELIVERED' && o.cod_status === 'HELD_BY_PARTNER'
            ? { ...o, cod_status: 'SETTLED_WITH_ADMIN', cash_settlement_id: settlementId }
            : o
        )
      );
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
