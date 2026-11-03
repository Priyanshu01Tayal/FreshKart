import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@freshkart/shared';
import { supabase, isSupabaseConfigured } from '../services/supabase';

export type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  initAuth: () => Promise<void>;
  sendOtp: (phone: string) => Promise<{ success: boolean; message?: string }>;
  verifyOtp: (phone: string, token: string) => Promise<{ success: boolean; message?: string }>;
  updateProfile: (fullName: string) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export function formatIndiaPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  const tenDigits = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91${tenDigits}`;
}

export function isValidIndianPhone(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  // Exactly 10 digits starting with 6-9, or 12 digits with 91 country code
  if (digits.length === 10) {
    return /^[6-9]\d{9}$/.test(digits);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return /^[6-9]\d{9}$/.test(digits.slice(2));
  }
  return false;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  initAuth: async () => {
    if (!isSupabaseConfigured) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      set({ isLoading: true, error: null });
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (session?.user) {
        // Fetch matching profile row
        const { data: profileData, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profError) {
          console.warn('Profile fetch error on init:', profError.message);
        }

        set({
          user: session.user,
          profile: profileData ?? null,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          profile: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }

      // Listen to auth state transitions
      supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (event === 'SIGNED_IN' && currentSession?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .maybeSingle();

          set({
            user: currentSession.user,
            profile: profileData ?? null,
            isAuthenticated: true,
            isLoading: false,
          });
        } else if (event === 'SIGNED_OUT') {
          // Important: Guest cart in useCartStore is NOT touched on sign out
          set({
            user: null,
            profile: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize session';
      set({ error: msg, isLoading: false, isAuthenticated: false });
    }
  },

  sendOtp: async (phone: string) => {
    if (!isValidIndianPhone(phone)) {
      return {
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number (starts with 6-9).',
      };
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        message: 'Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and ANON key.',
      };
    }

    const formattedPhone = formatIndiaPhone(phone);

    try {
      set({ isLoading: true, error: null });

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (otpError) {
        // Friendly mapping for common Supabase Auth errors
        let friendlyMsg = otpError.message;
        if (otpError.message.toLowerCase().includes('rate limit')) {
          friendlyMsg = 'Too many requests. Please wait a few moments before trying again.';
        } else if (otpError.message.toLowerCase().includes('sms provider')) {
          friendlyMsg =
            'SMS provider not configured on Supabase project. In development, configure phone auth provider in Supabase Dashboard -> Authentication -> Providers.';
        }

        set({ error: friendlyMsg, isLoading: false });
        return { success: false, message: friendlyMsg };
      }

      set({ isLoading: false });
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP code';
      set({ error: msg, isLoading: false });
      return { success: false, message: msg };
    }
  },

  verifyOtp: async (phone: string, token: string) => {
    const cleanToken = token.trim();
    if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
      return {
        success: false,
        message: 'Please enter a valid 6-digit verification code.',
      };
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        message: 'Supabase is not configured.',
      };
    }

    const formattedPhone = formatIndiaPhone(phone);

    try {
      set({ isLoading: true, error: null });

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: cleanToken,
        type: 'sms',
      });

      if (verifyError) {
        let friendlyMsg = verifyError.message;
        if (verifyError.message.toLowerCase().includes('expired')) {
          friendlyMsg = 'The OTP code has expired. Please request a new code.';
        } else if (verifyError.message.toLowerCase().includes('invalid')) {
          friendlyMsg = 'Incorrect OTP code. Please verify and try again.';
        }

        set({ error: friendlyMsg, isLoading: false });
        return { success: false, message: friendlyMsg };
      }

      if (!data.user) {
        set({ error: 'User session could not be established', isLoading: false });
        return { success: false, message: 'Authentication failed.' };
      }

      // Fetch or ensure profile
      let { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profileData) {
        // Fallback upsert strictly as role 'customer'
        const { data: newProfile, error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            phone_number: formattedPhone,
            full_name: 'FreshKart Customer',
            role: 'customer',
          })
          .select('*')
          .single();

        if (!upsertError && newProfile) {
          profileData = newProfile;
        }
      }

      set({
        user: data.user,
        profile: profileData ?? null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to verify OTP code';
      set({ error: msg, isLoading: false });
      return { success: false, message: msg };
    }
  },

  updateProfile: async (fullName: string) => {
    const { user, profile } = get();
    if (!user || !profile) {
      return { success: false, message: 'Must be logged in to update profile.' };
    }

    const trimmed = fullName.trim();
    if (trimmed.length < 2) {
      return { success: false, message: 'Please enter a valid full name (at least 2 characters).' };
    }

    try {
      set({ isLoading: true });

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: trimmed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      set({ profile: data, isLoading: false });
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      set({ isLoading: false });
      return { success: false, message: msg };
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });
      await supabase.auth.signOut();
      // Important: Zustand guest cart items are preserved in useCartStore
      set({
        user: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.warn('Sign out error:', err);
      set({
        user: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
