import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@freshkart/shared';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isSupabaseConnected: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.warn('[FreshKart Admin] Supabase credentials are not configured in environment.');
      setIsLoading(false);
      return;
    }

    // Check active Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleUserSession(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // Realtime Supabase auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await handleUserSession(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUserSession = async (authUser: User) => {
    try {
      setUser(authUser);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !data) {
        console.error('Failed to load user profile:', error);
        setIsAdmin(false);
        setProfile(null);
      } else {
        const profileRecord = data as unknown as Profile;
        setProfile(profileRecord);

        // Strict role validation: Only 'admin' role allowed
        if (profileRecord.role === 'admin' && profileRecord.is_active) {
          setIsAdmin(true);
        } else {
          console.warn(`[Access Denied] User ${authUser.id} has role '${profileRecord.role}', admin required.`);
          setIsAdmin(false);
          await supabase.auth.signOut();
        }
      }
    } catch (err) {
      console.error('Error handling user session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured) {
        return {
          error: 'Supabase is not configured. Please provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
        };
      }

      // Real Supabase Authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (!data.user) {
        return { error: 'Failed to authenticate user.' };
      }

      // Query database profile to verify administrator privileges
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const typedProfile = profileData as unknown as Profile | null;

      if (profileError || !typedProfile) {
        await supabase.auth.signOut();
        return { error: 'Profile not found. Please contact platform support.' };
      }

      // Enforce zero-trust role boundary: Block customers & delivery partners
      if (typedProfile.role !== 'admin') {
        await supabase.auth.signOut();
        return {
          error: `Access Denied: Account role '${typedProfile.role}' is not authorized to access the Admin Hub.`,
        };
      }

      if (!typedProfile.is_active) {
        await supabase.auth.signOut();
        return { error: 'Access Denied: Your administrator account has been deactivated.' };
      }

      setUser(data.user);
      setProfile(typedProfile);
      setIsAdmin(true);
      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during authentication';
      return { error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        isLoading,
        signIn,
        signOut,
        isSupabaseConnected: isSupabaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
