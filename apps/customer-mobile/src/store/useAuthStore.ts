import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@freshkart/shared';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User | null, profile: Profile | null) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, profile) =>
    set({
      user,
      profile,
      isAuthenticated: Boolean(user && profile),
      isLoading: false,
    }),

  clearAuth: () =>
    set({
      user: null,
      profile: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  setLoading: (isLoading) => set({ isLoading }),
}));
