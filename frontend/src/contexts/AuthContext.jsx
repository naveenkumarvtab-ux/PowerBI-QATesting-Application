import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    if (!isSupabaseConfigured) {
      return {
        access_token: 'local-dev-token',
        user: { id: '00000000-0000-0000-0000-000000000000', email: 'dev@pbi-qa.local' }
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      axios.defaults.headers.common.Authorization = `Bearer ${session.access_token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, [session]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    isSupabaseConfigured,
    signOut: () => {
      if (isSupabaseConfigured) {
        return supabase.auth.signOut();
      }
      setSession(null);
    },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
