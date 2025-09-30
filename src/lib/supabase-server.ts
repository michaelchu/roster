import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Use process.env for server-side context (Node.js)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables for server');
}

export const supabaseServer = createClient<Database>(supabaseUrl, supabaseAnonKey);
