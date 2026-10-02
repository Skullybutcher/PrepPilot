import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * AuthContext — provides session state and auth helpers to the whole app.
 *
 * Usage:
 *   const { user, loading, signIn, signUp, signOut } = useAuth();
 *
 * `user`    — Supabase User object or null
 * `loading` — true while the initial session check is in-flight
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Keep state in sync with Supabase auth events (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Sign in with email + password.
   * Returns { error } — caller handles the error message.
   */
  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  /**
   * Sign up with email + password.
   * Returns { error, needsConfirmation } where needsConfirmation=true means
   * Supabase sent a verification email (depends on project settings).
   */
  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    const needsConfirmation = !error && !data.session; // email confirm required
    return { error, needsConfirmation };
  };

  /** Sign out and clear session. */
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook — throws if used outside <AuthProvider>. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
