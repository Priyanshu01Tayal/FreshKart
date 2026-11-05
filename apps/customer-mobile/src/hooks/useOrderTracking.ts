import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { Database, OrderStatus } from '@freshkart/shared';

export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

export interface DeliveryPartnerInfo {
  id: string;
  full_name: string;
  phone_number: string | null;
}

export function useOrderTracking(orderId: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [deliveryPartner, setDeliveryPartner] = useState<DeliveryPartnerInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch delivery partner info if assigned
  const fetchPartnerInfo = useCallback(async (partnerId: string) => {
    try {
      const { data, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number')
        .eq('id', partnerId)
        .maybeSingle();

      if (!pErr && data) {
        setDeliveryPartner(data);
      }
    } catch {
      // Non-critical, ignore
    }
  }, []);

  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) {
      setError('Missing order ID.');
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

      // 1. Fetch Order Record
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr) {
        throw new Error(orderErr.message);
      }

      if (!orderData) {
        throw new Error('Order not found or access denied.');
      }

      setOrder(orderData);

      // 2. Fetch Line Items
      const { data: itemsData, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('total_price', { ascending: false });

      if (itemsErr) {
        throw new Error(itemsErr.message);
      }

      setItems(itemsData || []);

      // 3. Fetch Delivery Partner if assigned
      if (orderData.delivery_partner_id) {
        await fetchPartnerInfo(orderData.delivery_partner_id);
      } else {
        setDeliveryPartner(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch order details';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId, fetchPartnerInfo]);

  // Realtime subscription setup
  useEffect(() => {
    if (!orderId || !isSupabaseConfigured) return;

    fetchOrderDetails();

    // Subscribe to Realtime row-level updates for this specific order
    const channelName = `order_live_${orderId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        async (payload) => {
          const updatedOrder = payload.new as Order;
          setOrder(updatedOrder);

          // If delivery partner was newly assigned, fetch partner profile
          if (updatedOrder.delivery_partner_id) {
            fetchPartnerInfo(updatedOrder.delivery_partner_id);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [orderId, fetchOrderDetails, fetchPartnerInfo]);

  // Customer Cancellation Action
  const cancelOrder = useCallback(
    async (reason?: string) => {
      if (!orderId) {
        return { success: false, message: 'Order ID is missing' };
      }

      try {
        setIsCancelling(true);

        const { data, error: cancelErr } = await supabase.rpc('cancel_order', {
          p_order_id: orderId,
          p_reason: reason || 'Cancelled by customer via app',
        });

        if (cancelErr) {
          throw new Error(cancelErr.message);
        }

        // Optimistically update or refetch
        await fetchOrderDetails();
        return { success: true, message: 'Order cancelled successfully' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to cancel order';
        return { success: false, message: msg };
      } finally {
        setIsCancelling(false);
      }
    },
    [orderId, fetchOrderDetails]
  );

  return {
    order,
    items,
    deliveryPartner,
    loading,
    error,
    isCancelling,
    refetch: fetchOrderDetails,
    cancelOrder,
  };
}

