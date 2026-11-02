import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { Database } from '@freshkart/shared';

export type Product = Database['public']['Tables']['products']['Row'];

interface UseProductsOptions {
  initialCategoryId?: string | null;
  initialSearchQuery?: string;
}

export function useProducts(options: UseProductsOptions = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState<string | null>(options.initialCategoryId ?? null);
  const [searchQuery, setSearchQuery] = useState<string>(options.initialSearchQuery ?? '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>(options.initialSearchQuery ?? '');

  // 300ms debounce for search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const fetchProducts = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase connection not configured. Please set EXPO_PUBLIC_SUPABASE_URL.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchErr } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      setProducts(data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Client-side filtering across category and debounced search term
  const filteredProducts = useMemo(() => {
    let result = products;

    if (categoryId) {
      result = result.filter((p) => p.category_id === categoryId);
    }

    if (debouncedSearchQuery.length > 0) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.unit.toLowerCase().includes(q)
      );
    }

    return result;
  }, [products, categoryId, debouncedSearchQuery]);

  return {
    products: filteredProducts,
    allProducts: products,
    loading,
    error,
    refetch: fetchProducts,
    categoryId,
    setCategoryId,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
  };
}

