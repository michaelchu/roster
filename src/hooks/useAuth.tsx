import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getStorageItem, removeStorageItem, setStorageItem } from '@/lib/storage';
import { pushSubscriptionService } from '@/services/pushSubscriptionService';

const ADMIN_SESSION_KEY = 'adminSession';

/** Authentication context value type */
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isImpersonating: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  impersonate: (userId: string) => Promise<void>;
  stopImpersonating: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication provider component that wraps the app.
 * Manages auth state, listens for auth changes, and handles post-login redirects.
 * @param children - Child components to render within the provider
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        const returnUrl = getStorageItem('returnUrl');
        if (returnUrl) {
          removeStorageItem('returnUrl');
          const isSafeRelativePath = returnUrl.startsWith('/') && !returnUrl.startsWith('//');
          navigate(isSafeRelativePath ? returnUrl : '/');
        } else {
          const pendingInviteRaw = getStorageItem('pendingInvite');
          if (pendingInviteRaw) {
            // Always remove after reading (whether valid or malformed)
            removeStorageItem('pendingInvite');
            try {
              const pendingInvite = JSON.parse(pendingInviteRaw) as { type?: string; id?: string };
              if (pendingInvite.type && pendingInvite.id) {
                if (pendingInvite.type === 'event') {
                  navigate(`/signup/${pendingInvite.id}`);
                } else if (pendingInvite.type === 'group') {
                  navigate(`/groups/${pendingInvite.id}`);
                }
              }
            } catch {
              // Silently ignore malformed data - already removed from storage
            }
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  /**
   * Signs in a user with email and password.
   * @param email - User's email address
   * @param password - User's password
   * @throws Error if authentication fails
   */
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  /**
   * Creates a new user account.
   * @param email - User's email address
   * @param password - User's password
   * @param fullName - Optional display name stored in user metadata
   * @throws Error if registration fails
   */
  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
        },
      },
    });
    if (error) throw error;
  };

  /**
   * Initiates Google OAuth sign-in flow.
   * Redirects to Google for authentication.
   * @throws Error if OAuth initiation fails
   */
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/v1/callback`,
      },
    });
    if (error) throw error;
  };

  /**
   * Signs in using a Google ID token (for native app integrations).
   * @param idToken - Google OAuth ID token
   * @throws Error if authentication fails
   */
  const signInWithGoogleIdToken = async (idToken: string) => {
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw error;
  };

  /**
   * Signs out the current user.
   * Also cleans up push notification subscription from the database to prevent
   * notifications from being sent to the wrong user on shared devices.
   * Note: Browser subscription is preserved so users don't need to re-grant
   * permission when signing back in.
   * @throws Error if sign out fails
   */
  const signOut = async () => {
    // Remove subscription from database only (keep browser subscription)
    // This prevents notifications from leaking to the next user while
    // preserving browser permission for easier re-subscription
    try {
      await pushSubscriptionService.removeSubscriptionFromDatabase();
    } catch {
      // Don't block sign out if cleanup fails
    }

    // Clear any saved admin session on full sign out
    removeStorageItem(ADMIN_SESSION_KEY);

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  /**
   * Impersonates another user by calling the impersonate-user edge function.
   * Saves the current admin session so it can be restored later.
   * Only available to platform admins (app_metadata.is_admin = true).
   */
  const impersonate = useCallback(
    async (userId: string) => {
      if (!session) throw new Error('Must be signed in to impersonate');

      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: { user_id: userId },
      });

      if (error) throw error;
      if (!data?.session) throw new Error('No session returned from impersonation');

      // Save the current admin session for later restoration
      setStorageItem(
        ADMIN_SESSION_KEY,
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
      );

      // Set the impersonated session
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    },
    [session]
  );

  /**
   * Stops impersonating and restores the original admin session.
   */
  const stopImpersonating = useCallback(async () => {
    const savedSession = getStorageItem(ADMIN_SESSION_KEY);
    if (!savedSession) throw new Error('No admin session to restore');

    const { access_token, refresh_token } = JSON.parse(savedSession);
    removeStorageItem(ADMIN_SESSION_KEY);

    await supabase.auth.setSession({ access_token, refresh_token });
  }, []);

  const isAdmin = useMemo(() => !!user?.app_metadata?.is_admin, [user]);
  const isImpersonating = useMemo(() => !!getStorageItem(ADMIN_SESSION_KEY), [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        isImpersonating,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithGoogleIdToken,
        signOut,
        impersonate,
        stopImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context.
 * Must be used within an AuthProvider.
 * @returns Authentication context with user, session, loading state, and auth methods
 * @throws Error if used outside of AuthProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
