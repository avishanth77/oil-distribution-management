import React, { createContext, useContext, useState, useEffect } from 'react';
import { dataStore } from '../lib/dataStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { INITIAL_PROFILES } from '../lib/mockData';

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
            setSession(sbSession);
            const profile = findProfileForUser(sbSession.user, dataStore.profiles);
            if (profile && mounted) {
              if (profile.is_active === false) {
                await supabase.auth.signOut();
                localStorage.removeItem('petroflow_auth_user');
                localStorage.removeItem('petroflow_active_user');
                setSession(null);
                setAuthError('This account has been deactivated. Please contact your Operations Manager.');
                setIsLoading(false);
                return;
              }
              setCurrentUser(profile);
              localStorage.setItem('petroflow_auth_user', JSON.stringify(profile));
              setIsLoading(false);
              return;
            }
          }

          // Listen to live Supabase auth state changes
          supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (!mounted) return;
            if (newSession?.user) {
              setSession(newSession);
              const p = findProfileForUser(newSession.user, dataStore.profiles);
              if (p) {
                setCurrentUser(p);
                localStorage.setItem('petroflow_auth_user', JSON.stringify(p));
              }
            } else if (event === 'SIGNED_OUT') {
              setSession(null);
              setCurrentUser(null);
              localStorage.removeItem('petroflow_auth_user');
              localStorage.removeItem('petroflow_active_user');
            }
          });
        }

        // 2. Check local stored user session
        const storedUser = localStorage.getItem('petroflow_auth_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            // Verify profile against current dataStore
            const matched = dataStore.profiles.find(
              (p) => p.id === parsed.id || p.email?.toLowerCase() === parsed.email?.toLowerCase()
            );
            if (matched && mounted) {
              if (matched.is_active === false) {
                localStorage.removeItem('petroflow_auth_user');
                localStorage.removeItem('petroflow_active_user');
                setAuthError('This account has been deactivated. Please contact your Operations Manager.');
                setIsLoading(false);
                return;
              }
              setCurrentUser(matched);
              setIsLoading(false);
              return;
            } else if (parsed && mounted) {
              setCurrentUser(parsed);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Failed to parse petroflow_auth_user:', e);
          }
        }
      } catch (err) {
        console.error('Error during auth initialization:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Helper to match Supabase user to local or cloud profile
  function findProfileForUser(sbUser, availableProfiles) {
    if (!sbUser) return null;
    const byEmail = availableProfiles.find(
      (p) => p.email?.toLowerCase() === sbUser.email?.toLowerCase()
    );
    if (byEmail) return byEmail;

    const byId = availableProfiles.find((p) => p.id === sbUser.id);
    if (byId) return byId;

    // Synthesize profile from user metadata if not yet created in dataStore
    const userRole = sbUser.user_metadata?.role || (sbUser.email?.includes('manager') ? 'manager' : 'staff');
    return {
      id: sbUser.id,
      email: sbUser.email,
      full_name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User',
      role: userRole,
      phone: sbUser.user_metadata?.phone || '+91 98000 00000',
      is_active: true,
    };
  }

  const isManager = Boolean(currentUser && currentUser.role === 'manager');
  const isStaff = Boolean(currentUser && currentUser.role === 'staff');
  const isAuthenticated = Boolean(currentUser);

  // Sign In function supporting Supabase Auth + Demo fallbacks
  const login = async ({ email, password }) => {
    setAuthError(null);
    if (!email || !password) {
      throw new Error('Please enter both email and password.');
    }

    let input = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    // Support common manager aliases
    if (input === 'manager' || input === 'admin' || input === 'operations manager' || input === 'oilmanager') {
      input = 'manager@texol.com';
    }

    // 1. Attempt Supabase Auth if client is configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: input,
          password: cleanPassword,
        });

        if (!error && data?.user) {
          setSession(data.session);
          let profile = findProfileForUser(data.user, dataStore.profiles);

          if (!profile) {
            try {
              const { data: dbProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();
              if (dbProfile) profile = dbProfile;
            } catch {
              // Ignore if profile lookup fails
            }
          }

          if (!profile) {
            profile = {
              id: data.user.id,
              email: data.user.email,
              full_name: data.user.user_metadata?.full_name || input.split('@')[0],
              role: data.user.user_metadata?.role || (input.includes('manager') ? 'manager' : 'staff'),
              is_active: true,
            };
          }

          if (profile.is_active === false) {
            const deactivated = 'This account has been deactivated. Please contact your Operations Manager.';
            await supabase.auth.signOut();
            setAuthError(deactivated);
            throw new Error(deactivated);
          }

          setCurrentUser(profile);
          localStorage.setItem('petroflow_auth_user', JSON.stringify(profile));
          return { success: true, user: profile };
        }
      } catch (sbErr) {
        if (sbErr.message?.startsWith('This account has been deactivated')) throw sbErr;
        console.warn('Supabase signIn notice:', sbErr.message);
      }
    }

    // 2. Search dataStore.profiles by email OR full_name
    let matchedProfile = dataStore.profiles.find(
      (p) => p.email?.toLowerCase() === input || p.full_name?.toLowerCase() === input
    );

    // If not found in dataStore.profiles, check INITIAL_PROFILES directly
    if (!matchedProfile) {
      matchedProfile = INITIAL_PROFILES.find(
        (p) => p.email?.toLowerCase() === input || p.full_name?.toLowerCase() === input
      );
      if (matchedProfile) {
        dataStore.profiles.push(matchedProfile);
      }
    }

    // Also support any Supabase profile matched by username/email prefix
    if (!matchedProfile) {
      matchedProfile = dataStore.profiles.find(
        (p) => p.email?.toLowerCase().startsWith(input)
      );
    }

    if (matchedProfile) {
      if (matchedProfile.is_active === false) {
        const deactivated = 'This account has been deactivated. Please contact your Operations Manager.';
        setAuthError(deactivated);
        throw new Error(deactivated);
      }

      const savedPw = dataStore.staffPasswords?.[matchedProfile.id]?.password;
      const isManagerAccount = matchedProfile.role === 'manager';

      const isManagerMatch =
        isManagerAccount &&
        ['manager123', 'admin', 'admin123', 'manager', 'texol2026'].includes(cleanPassword);

      const isCustomMatch = savedPw && savedPw === cleanPassword;

      if (isManagerMatch || isCustomMatch) {
        setCurrentUser(matchedProfile);
        localStorage.setItem('petroflow_auth_user', JSON.stringify(matchedProfile));
        return { success: true, user: matchedProfile };
      } else {
        const msg = 'Invalid email or password. Please check your credentials or contact an administrator.';
        setAuthError(msg);
        throw new Error(msg);
      }
    }

    // Fallback: Operations Manager login
    if (input === 'manager@texol.com' && ['manager123', 'admin', 'admin123', 'texol2026'].includes(cleanPassword)) {
      const defaultManager = {
        id: 'usr-mgr-1',
        email: 'manager@texol.com',
        full_name: 'Operations Manager',
        role: 'manager',
        phone: '+91 98200 99001',
        is_active: true,
      };
      setCurrentUser(defaultManager);
      localStorage.setItem('petroflow_auth_user', JSON.stringify(defaultManager));
      return { success: true, user: defaultManager };
    }

    const notFound = 'Invalid email or password. Please check your credentials or contact an administrator.';
    setAuthError(notFound);
    throw new Error(notFound);
  };

  // Sign Up / Register new account
  const signUp = async ({ email, password, full_name, role = 'staff', phone = '' }) => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();

    let newProfile = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name, role, phone },
          },
        });
        if (error) throw error;
        if (data?.user) {
          newProfile = {
            id: data.user.id,
            email: cleanEmail,
            full_name,
            role,
            phone,
            is_active: true,
          };
        }
      } catch (err) {
        console.warn('Supabase signUp warning:', err.message);
      }
    }

    if (!newProfile) {
      newProfile = {
        id: 'usr-' + (role === 'manager' ? 'mgr-' : 'stf-') + Date.now(),
        email: cleanEmail,
        full_name,
        role,
        phone,
        is_active: true,
      };
      dataStore.profiles.push(newProfile);
      if (!dataStore.staffPasswords) dataStore.staffPasswords = {};
      dataStore.staffPasswords[newProfile.id] = { password };
      dataStore.saveLocalState();
      dataStore.notify();
    }

    setCurrentUser(newProfile);
    localStorage.setItem('petroflow_auth_user', JSON.stringify(newProfile));
    return { success: true, user: newProfile };
  };

  // Sign out and clear active session
  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut warning:', err);
      }
    }
    localStorage.removeItem('petroflow_auth_user');
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
