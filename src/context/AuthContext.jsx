import React, { createContext, useContext, useState, useEffect } from 'react';
import { dataStore } from '../lib/dataStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logError, logWarn } from '../lib/logger';

// Offline demo authentication exists only for local development with no
// Supabase connection. It is stripped from production bundles and can never
// authorise a login against a real deployment.
const DEMO_AUTH_ENABLED = Boolean(import.meta.env?.DEV) && !isSupabaseConfigured;
const DEMO_DEV_PASSWORD = 'local-dev-only';

const AUTH_USER_KEY = 'petroflow_auth_user';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [profiles, setProfiles] = useState(dataStore.profiles);
  const [currentUser, setCurrentUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  // Synchronize profiles and state when dataStore changes
  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setProfiles([...dataStore.profiles]);
      setDataVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        // 1. Check for active Supabase session if configured
        if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.auth.getSession();
          const sbSession = data?.session;
          if (sbSession?.user) {
            const profile = await resolveProfile(sbSession.user);
            if (profile && mounted) {
              if (profile.is_active === false) {
                await supabase.auth.signOut();
                localStorage.removeItem(AUTH_USER_KEY);
                localStorage.removeItem('petroflow_active_user');
                setSession(null);
                setAuthError('This account has been deactivated. Please contact your Operations Manager.');
                setIsLoading(false);
                return;
              }
              setSession(sbSession);
              setCurrentUser(profile);
              localStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile));
              setIsLoading(false);
              return;
            }
          }

          // Listen to live Supabase auth state changes
          supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (!mounted) return;
            if (newSession?.user) {
              const p = await resolveProfile(newSession.user);
              if (p?.is_active === false) {
                await supabase.auth.signOut();
                setSession(null);
                setCurrentUser(null);
                localStorage.removeItem(AUTH_USER_KEY);
                localStorage.removeItem('petroflow_active_user');
                return;
              }
              setSession(newSession);
              setCurrentUser(p);
              localStorage.setItem(AUTH_USER_KEY, JSON.stringify(p));
            } else if (event === 'SIGNED_OUT') {
              setSession(null);
              setCurrentUser(null);
              localStorage.removeItem(AUTH_USER_KEY);
              localStorage.removeItem('petroflow_active_user');
            }
          });
        }

        // 2. Check local stored user session
        const storedUser = localStorage.getItem(AUTH_USER_KEY);
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            // Verify profile against current dataStore
            const matched = dataStore.profiles.find(
              (p) => p.id === parsed.id || p.email?.toLowerCase() === parsed.email?.toLowerCase()
            );
            if (matched && mounted) {
              if (matched.is_active === false) {
                localStorage.removeItem(AUTH_USER_KEY);
                localStorage.removeItem('petroflow_active_user');
                setAuthError('This account has been deactivated. Please contact your Operations Manager.');
                setIsLoading(false);
                return;
              }
              setCurrentUser(matched);
              setIsLoading(false);
              return;
            } else if (parsed && mounted && DEMO_AUTH_ENABLED) {
              // Offline demo identity is trusted only in local dev builds.
              setCurrentUser(parsed);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            logWarn('Failed to parse stored auth user:', e);
          }
        }
      } catch (err) {
        logError('Error during auth initialization:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Resolve the authoritative profile for a signed-in Supabase user.
  // Role and activation state always come from the profiles row, never from
  // attacker-controllable auth metadata (user_metadata) or the email string.
  async function resolveProfile(sbUser) {
    if (!sbUser) return null;

    const local = dataStore.profiles.find((p) => p.id === sbUser.id);
    if (local) return local;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: dbProfile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sbUser.id)
          .single();
        if (!error && dbProfile) return dbProfile;
      } catch (err) {
        logWarn('Profile lookup failed:', err.message);
      }
    }

    // No profile row yet: default to the least-privileged staff role.
    return {
      id: sbUser.id,
      email: sbUser.email,
      full_name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User',
      role: 'staff',
      phone: sbUser.user_metadata?.phone || null,
      is_active: true,
    };
  }

  const isManager = Boolean(currentUser && currentUser.role === 'manager');
  const isStaff = Boolean(currentUser && currentUser.role === 'staff');
  const isAuthenticated = Boolean(currentUser);

  // Sign in through Supabase Auth. The offline demo identity path is only
  // reachable in local development builds (see DEMO_AUTH_ENABLED).
  const login = async ({ email, password }) => {
    setAuthError(null);
    if (!email || !password) {
      throw new Error('Please enter both email and password.');
    }

    const input = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input,
        password: cleanPassword,
      });

      if (error) {
        throw new Error('Invalid email or password. Please check your credentials or contact an administrator.');
      }

      if (data?.user) {
        const profile = await resolveProfile(data.user);

        if (profile?.is_active === false) {
          await supabase.auth.signOut();
          const deactivated =
            'This account has been deactivated. Please contact your Operations Manager.';
          setAuthError(deactivated);
          throw new Error(deactivated);
        }

        setSession(data.session);
        setCurrentUser(profile);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile));
        return { success: true, user: profile };
      }
    }

    // Offline demo identity. Compiled out of production bundles entirely
    // (requires import.meta.env.DEV) and only reachable when no Supabase
    // connection is configured, so it can never authorise a real login.
    if (DEMO_AUTH_ENABLED) {
      const matchedProfile = dataStore.profiles.find((p) => p.email?.toLowerCase() === input);

      if (matchedProfile && matchedProfile.is_active !== false) {
        if (DEMO_DEV_PASSWORD === cleanPassword) {
          setCurrentUser(matchedProfile);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(matchedProfile));
          return { success: true, user: matchedProfile };
        }
      }

      const notFound = 'Invalid email or password. Please check your credentials or contact an administrator.';
      setAuthError(notFound);
      throw new Error(notFound);
    }

    const notFound = 'Invalid email or password. Please check your credentials or contact an administrator.';
    setAuthError(notFound);
    throw new Error(notFound);
  };

  // Staff self-registration. Always creates a 'staff' account: the requested
  // role is intentionally discarded because user_metadata is attacker
  // controlled and was previously copied straight into profiles.role.
  const signUp = async ({ email, password, full_name, phone = '' }) => {
    setAuthError(null);

    if (!email || !password || !full_name) {
      throw new Error('Full name, email, and password are required.');
    }
    if (String(password).length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const cleanEmail = email.trim().toLowerCase();
    let newProfile = null;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { full_name, phone },
        },
      });
      if (error) throw error;
      if (data?.user) {
        newProfile = await resolveProfile(data.user);
      }
    }

    // Offline demo registration. Never stores the password and never mints a
    // manager; unavailable in production builds.
    if (!newProfile && DEMO_AUTH_ENABLED) {
      newProfile = {
        id: 'usr-stf-' + Date.now(),
        email: cleanEmail,
        full_name,
        role: 'staff',
        phone,
        is_active: true,
      };
      dataStore.profiles.push(newProfile);
      dataStore.saveLocalState();
      dataStore.notify();
    }

    if (!newProfile) {
      throw new Error('Registration is unavailable. Please ask an Operations Manager to create your account.');
    }

    setCurrentUser(newProfile);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newProfile));
    return { success: true, user: newProfile };
  };

  // Sign out: clear the session and the locally cached dataset so no
  // customer, ledger, or profile data survives on a shared device.
  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        logWarn('Supabase signOut warning:', err);
      }
    }
    dataStore.clearLocalCache();
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem('petroflow_active_user');
    setCurrentUser(null);
    setSession(null);
  };

  // Role-Based Access Control (RBAC) permission checker
  const can = (permission) => {
    if (!currentUser) return false;
    if (isManager) return true; // Operations Managers hold all privileges

    // Staff permissions
    const staffAllowed = [
      'record_delivery',
      'request_advance',
      'record_expense',
      'view_ledger',
      'view_routes',
      'view_stations',
      'view_deliveries',
      'view_advances',
      'view_dashboard',
      'view_schema',
    ];
    return staffAllowed.includes(permission);
  };

  const triggerRefresh = () => {
    setDataVersion((v) => v + 1);
    dataStore.fetchFromSupabase();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        session,
        isAuthenticated,
        isManager,
        isStaff,
        isLoading,
        authError,
        profiles,
        login,
        signUp,
        logout,
        can,
        dataVersion,
        triggerRefresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
