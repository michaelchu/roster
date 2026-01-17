import { toast } from 'sonner';

import { supabase } from './supabase';

/**
 * Validates the current user session and redirects to login if invalid
 * @returns The validated user object or null if session is invalid
 */
export async function validateSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session || !session.user) {
    // Session is invalid or expired
    toast.error('Your session has expired. Please sign in again.');

    // Store current path to return after login
    const currentPath = window.location.pathname;
    if (currentPath !== '/auth/login' && currentPath !== '/auth/register') {
      localStorage.setItem('returnUrl', currentPath);
    }

    // Redirect to login
    window.location.href = '/auth/login';
    return null;
  }

  return session.user;
}

/**
 * Validates session and throws error if invalid
 * Use this in service methods that require authentication
 */
export async function requireValidSession() {
  const user = await validateSession();
  if (!user) {
    throw new Error('Session expired');
  }
  return user;
}
