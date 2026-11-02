import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { Database } from '@freshkart/shared';

export type StoreSettings = Database['public']['Tables']['store_settings']['Row'];

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase connection not configured. Please set EXPO_PUBLIC_SUPABASE_URL.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from('store_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      if (!data) {
        throw new Error('Store settings not found in database.');
      }

      setSettings(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch store settings';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
  };
}

