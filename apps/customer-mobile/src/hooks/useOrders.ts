import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { useAuthStore } from '../store/useAuthStore';
import type { Database } from '@freshkart/shared';

export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];

export interface OrderWithSummary extends Order {
  item_count?: number;
  items_summary?: string;
}

export function useOrders() {
  const [orders, setOrders] = useState<OrderWithSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Supabase connection not configured.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch user's orders from PostgreSQL
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', user.id)
        .order('placed_at', { ascending: false });

      if (ordersErr) {
        throw new Error(ordersErr.message);
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      // Fetch line items for summary preview
      const orderIds = ordersData.map((o) => o.id);
      const { data: itemsData, error: itemsErr } = await supabase
        .from('order_items')
        .select('order_id, product_name, quantity, unit')
        .in('order_id', orderIds);

      if (itemsErr) {
        // Proceed with raw orders if item summary fails
        setOrders(ordersData);
        return;
      }

      // Map items to orders
      const orderMap = new Map<string, { count: number; names: string[] }>();
      (itemsData || []).forEach((item) => {
        const cur = orderMap.get(item.order_id) || { count: 0, names: [] };
        cur.count += item.quantity;
        cur.names.push(`${item.product_name} (${item.quantity} ${item.unit})`);
        orderMap.set(item.order_id, cur);
      });

      const enriched: OrderWithSummary[] = ordersData.map((o) => {
        const info = orderMap.get(o.id);
        return {
          ...o,
          item_count: info ? info.count : 0,
          items_summary: info ? info.names.slice(0, 2).join(', ') + (info.names.length > 2 ? ` + ${info.names.length - 2} more` : '') : '',
        };
      });

      setOrders(enriched);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load orders';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
  };
}

