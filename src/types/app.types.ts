import type { Database } from './supabase';

// Re-export Database
export type { Database, Json } from './supabase';

// Helper types for easier access
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Custom field types for forms
export interface CustomField {
  id?: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select';
  required: boolean;
  options?: string[];
}

// Response types for form data
export type FormResponse = string | number | string[];
export type ResponseRecord = Record<string, FormResponse>;
