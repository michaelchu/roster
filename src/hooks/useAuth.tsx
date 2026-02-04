import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getStorageItem, removeStorageItem } from '@/lib/storage';

/** Authentication context value type */
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
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
   * @throws Error if sign out fails
   */
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithGoogleIdToken,
        signOut,
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
