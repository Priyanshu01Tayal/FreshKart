import { useState, useEffect, useCallback } from 'react';
import type { Database } from '@freshkart/shared';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { useAuthStore } from '../store/useAuthStore';

export type Address = Database['public']['Tables']['addresses']['Row'];
export type AddressInsert = Database['public']['Tables']['addresses']['Insert'];

export interface AddressInput {
  label: 'Home' | 'Work' | 'Other';
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export function useAddresses() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    if (!isAuthenticated || !user || !isSupabaseConfigured) {
      setAddresses([]);
      setSelectedAddress(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchErr } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchErr) {
        throw fetchErr;
      }

      const list = data || [];
      setAddresses(list);

      // Default selected address to whichever is marked is_default, or the first in list
      const defaultAddr = list.find((a) => a.is_default) || list[0] || null;
      setSelectedAddress((prev) => (prev ? list.find((a) => a.id === prev.id) || defaultAddr : defaultAddr));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch addresses';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const addAddress = async (
    input: AddressInput
  ): Promise<{ success: boolean; data?: Address; message?: string }> => {
    if (!user) {
      return { success: false, message: 'Authentication required to save addresses.' };
    }

    const recipient = input.recipient_name.trim();
    const phone = input.phone.trim();
    const line1 = input.address_line1.trim();
    const city = input.city?.trim() || '';
    const state = input.state?.trim() || '';
    const pincode = input.pincode.trim();

    if (!recipient) return { success: false, message: 'Recipient name is required.' };
    if (!phone || phone.length < 10) return { success: false, message: 'Valid 10-digit phone is required.' };
    if (!line1) return { success: false, message: 'House/flat number is required.' };
    if (!city) return { success: false, message: 'City is required.' };
    if (!state) return { success: false, message: 'State is required.' };
    if (!pincode || pincode.length !== 6) return { success: false, message: 'Valid 6-digit PIN code is required.' };

    try {
      setLoading(true);

      const isFirst = addresses.length === 0;
      const makeDefault = isFirst || Boolean(input.is_default);

      // If this address is default, clear existing defaults first
      if (makeDefault && addresses.length > 0) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const newAddr: AddressInsert = {
        user_id: user.id,
        label: input.label,
        recipient_name: recipient,
        phone,
        address_line1: line1,
        address_line2: input.address_line2?.trim() || null,
        landmark: input.landmark?.trim() || null,
        city,
        state,
        pincode,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        is_default: makeDefault,
      };

      const { data, error: insertErr } = await supabase
        .from('addresses')
        .insert(newAddr)
        .select('*')
        .single();

      if (insertErr) {
        throw insertErr;
      }

      await fetchAddresses();
      if (data) {
        setSelectedAddress(data);
      }
      return { success: true, data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save address';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const updateAddress = async (
    id: string,
    input: Partial<AddressInput>
  ): Promise<{ success: boolean; data?: Address; message?: string }> => {
    if (!user) return { success: false, message: 'Authentication required.' };

    try {
      setLoading(true);

      if (input.is_default) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const updates: Partial<AddressInsert> = {
        updated_at: new Date().toISOString(),
      };

      if (input.label !== undefined) updates.label = input.label;
      if (input.recipient_name !== undefined) updates.recipient_name = input.recipient_name.trim();
      if (input.phone !== undefined) updates.phone = input.phone.trim();
      if (input.address_line1 !== undefined) updates.address_line1 = input.address_line1.trim();
      if (input.address_line2 !== undefined) updates.address_line2 = input.address_line2?.trim() || null;
      if (input.landmark !== undefined) updates.landmark = input.landmark?.trim() || null;
      if (input.city !== undefined) updates.city = input.city.trim();
      if (input.state !== undefined) updates.state = input.state.trim();
      if (input.pincode !== undefined) updates.pincode = input.pincode.trim();
      if (input.is_default !== undefined) updates.is_default = input.is_default;
      if (input.latitude !== undefined) updates.latitude = input.latitude;
      if (input.longitude !== undefined) updates.longitude = input.longitude;

      const { data, error: updateErr } = await supabase
        .from('addresses')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (updateErr) {
        throw updateErr;
      }

      await fetchAddresses();
      return { success: true, data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update address';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = async (id: string): Promise<{ success: boolean; message?: string }> => {
    if (!user) return { success: false, message: 'Authentication required.' };

    try {
      setLoading(true);

      const { error: delErr } = await supabase
        .from('addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (delErr) {
        throw delErr;
      }

      await fetchAddresses();
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete address';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const setDefaultAddress = async (id: string): Promise<{ success: boolean; message?: string }> => {
    return updateAddress(id, { is_default: true });
  };

  return {
    addresses,
    selectedAddress,
    setSelectedAddress,
    loading,
    error,
    refetch: fetchAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  };
}

