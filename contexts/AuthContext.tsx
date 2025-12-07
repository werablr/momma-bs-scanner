import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import scannerAPI from '../services/scannerAPI';

interface Household {
  id: string;
  name: string;
  settings: any; // TODO: Define proper settings type
}

interface AuthContextType {
  user: User | null;
  household: Household | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signUp: (email: string, password: string, displayName?: string | null) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<void>;
  loadHousehold: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);
          await loadHouseholdInternal(session.user.id);
        }
      } catch (error) {
        console.error('❌ Auth init failed:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Internal version that doesn't set loading
    const loadHouseholdInternal = async (userId: string) => {
      try {
        setError(null);
        console.log('🏠 Fetching household for user:', userId);
        const householdData = await scannerAPI.getUserHousehold(userId);
        console.log('✅ User household fetched:', householdData);
        const household = Array.isArray(householdData) ? householdData[0] : householdData;
        if (isMounted) {
          setHousehold(household || null);
        }
      } catch (error: any) {
        console.error('❌ Failed to load household:', error);
        if (isMounted) {
          setError('Failed to load household data');
        }
      }
    };

    initAuth();

    // Listen for auth changes (sign in/out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event, session?.user?.email);

      // Only handle explicit sign in/out, not token refresh
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setLoading(true);
        await loadHouseholdInternal(session.user.id);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setHousehold(null);
      }
      // Ignore TOKEN_REFRESHED - we already have the data
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadHousehold = async (userId: string): Promise<void> => {
    try {
      setError(null);
      const householdData = await scannerAPI.getUserHousehold(userId);
      // Supabase returns joined data as an array, take first element
      const household = Array.isArray(householdData) ? householdData[0] : householdData;
      setHousehold(household || null);
    } catch (error: any) {
      console.error('❌ Failed to load household:', error);
      setError('Failed to load household data');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      console.error('❌ Sign in failed:', error);
      setError(error.message);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, displayName: string | null = null) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error: any) {
      console.error('❌ Sign up failed:', error);
      setError(error.message);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      console.error('❌ Sign out failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    household,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    loadHousehold,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
