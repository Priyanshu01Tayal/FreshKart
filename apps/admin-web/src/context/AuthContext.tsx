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
  isDevMode: boolean;
  enableDevAdmin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDevMode, setIsDevMode] = useState<boolean>(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // If no live Supabase config, check if dev admin session is active
      const devActive = localStorage.getItem('freshkart_dev_admin_active') === 'true';
      if (devActive) {
        setDevAdminSession();
      } else {
        setIsLoading(false);
      }
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleUserSession(session.user);
      } else {
        setIsLoading(false);
      }
    });

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
        console.error('Failed to load profile:', error);
        setIsAdmin(false);
        setProfile(null);
      } else {
        const profileRecord = data as unknown as Profile;
        setProfile(profileRecord);
        if (profileRecord.role === 'admin' && profileRecord.is_active) {
          setIsAdmin(true);
        } else {
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

  const setDevAdminSession = () => {
    const mockAdminUser = {
      id: '00000000-0000-0000-0000-000000000001',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'admin@freshkart.local',
      phone: '+919876543210',
    } as User;

    const mockAdminProfile: Profile = {
      id: '00000000-0000-0000-0000-000000000001',
      phone_number: '+919876543210',
      full_name: 'Store Administrator',
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setUser(mockAdminUser);
    setProfile(mockAdminProfile);
    setIsAdmin(true);
    setIsDevMode(true);
    localStorage.setItem('freshkart_dev_admin_active', 'true');
    setIsLoading(false);
  };

  const enableDevAdmin = () => {
    setDevAdminSession();
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured) {
        if (email.toLowerCase().includes('admin') || password === 'admin123') {
          setDevAdminSession();
          return { error: null };
        }
        return { error: 'Invalid admin credentials. (Hint: use admin@freshkart.local / admin123)' };
      }

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

      // Check profile role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const typedProfile = profileData as unknown as Profile | null;
      if (profileError || !typedProfile || typedProfile.role !== 'admin') {
        await supabase.auth.signOut();
        return { error: 'Access Denied: Your account does not have administrator privileges.' };
      }

      setUser(data.user);
      setProfile(typedProfile);
      setIsAdmin(true);
      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      return { error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    localStorage.removeItem('freshkart_dev_admin_active');
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setIsLoading(false);
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
        isDevMode,
        enableDevAdmin,
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
