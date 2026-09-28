import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import supabase from '../lib/supabase';
import { apiGet } from '../api/client';

export const AuthContext = createContext(null);

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const isSigningUpRef = useRef(false);

  const startSignUp = useCallback(() => {
    isSigningUpRef.current = true;
  }, []);

  const endSignUp = useCallback(() => {
    isSigningUpRef.current = false;
  }, []);

  const reloadProfile = useCallback(async () => {
    try {
      const data = await apiGet('/auth/me');
      setProfile(data);
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      setSession(activeSession);
      return data;
    } catch (err) {
      if (err.status === 401 || err.status === 404) {
        setProfile(null);
      } else {
        console.error('Failed to reload profile:', err);
        setProfile(null);
      }
      return null;
    } finally {
      isSigningUpRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error) {
          console.error('Error fetching initial session:', error);
        }

        if (initialSession) {
          try {
            const userProfile = await apiGet('/auth/me');
            if (isMounted) {
              setProfile(userProfile);
              setSession(initialSession);
            }
          } catch (err) {
            if (isMounted) {
              if (err.status === 401 || err.status === 404) {
                setProfile(null);
              } else {
                console.error('Failed to fetch profile on init:', err);
                setProfile(null);
              }
              setSession(initialSession);
            }
          }
        } else {
          setSession(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      // When sign-up is in flight in Login.jsx, do not prematurely unmount Login.jsx
      if (isSigningUpRef.current) {
        return;
      }

      if (newSession) {
        setLoading(true);
        try {
          const userProfile = await apiGet('/auth/me');
          if (isMounted) {
            setProfile(userProfile);
            setSession(newSession);
          }
        } catch (err) {
          if (isMounted) {
            if (err.status === 401 || err.status === 404) {
              setProfile(null);
            } else {
              console.error('Failed to fetch profile on auth state change:', err);
              setProfile(null);
            }
            setSession(newSession);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      } else {
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    session,
    profile,
    loading,
    reloadProfile,
    startSignUp,
    endSignUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthProvider;
