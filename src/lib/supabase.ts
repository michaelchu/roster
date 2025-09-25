import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface CustomField {
  id?: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export type Database = {
  public: {
    Tables: {
      organizers: {
        Row: {
          id: string
          name: string | null
          created_at: string
        }
        Insert: {
          id: string
          name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          organizer_id: string
          name: string
          description: string | null
          datetime: string | null
          location: string | null
          is_private: boolean
          custom_fields: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
          created_at: string
          parent_event_id: string | null
        }
        Insert: {
          id?: string
          organizer_id: string
          name: string
          description?: string | null
          datetime?: string | null
          location?: string | null
          is_private?: boolean
          custom_fields?: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
          created_at?: string
          parent_event_id?: string | null
        }
        Update: {
          id?: string
          organizer_id?: string
          name?: string
          description?: string | null
          datetime?: string | null
          location?: string | null
          is_private?: boolean
          custom_fields?: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
          created_at?: string
          parent_event_id?: string | null
        }
      }
      participants: {
        Row: {
          id: string
          event_id: string
          name: string
          email: string | null
          phone: string | null
          responses: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          email?: string | null
          phone?: string | null
          responses?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          responses?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
          created_at?: string
        }
      }
      labels: {
        Row: {
          id: string
          event_id: string
          name: string
          color: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          color?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          color?: string
        }
      }
      participant_labels: {
        Row: {
          id: string
          participant_id: string
          label_id: string
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          label_id: string
          created_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          label_id?: string
          created_at?: string
        }
      }
    }
  }
}