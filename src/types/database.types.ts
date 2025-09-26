export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Custom field types with proper structure
export interface CustomField {
  id?: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select';
  required: boolean;
  options?: string[];
}

// Response types for form data
export type FormResponse = string | number | boolean | string[];
export type ResponseRecord = Record<string, FormResponse>;

export interface Database {
  public: {
    Tables: {
      organizers: {
        Row: {
          id: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          organizer_id: string;
          name: string;
          description: string | null;
          datetime: string | null;
          location: string | null;
          is_private: boolean;
          custom_fields: Json;
          created_at: string;
          parent_event_id: string | null;
          max_participants: number | null;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          name: string;
          description?: string | null;
          datetime?: string | null;
          location?: string | null;
          is_private?: boolean;
          custom_fields?: Json;
          created_at?: string;
          parent_event_id?: string | null;
          max_participants?: number | null;
        };
        Update: {
          id?: string;
          organizer_id?: string;
          name?: string;
          description?: string | null;
          datetime?: string | null;
          location?: string | null;
          is_private?: boolean;
          custom_fields?: Json;
          created_at?: string;
          parent_event_id?: string | null;
          max_participants?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_organizer_id_fkey';
            columns: ['organizer_id'];
            referencedRelation: 'organizers';
            referencedColumns: ['id'];
          },
        ];
      };
      participants: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          notes: string | null;
          user_id: string | null;
          responses: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          user_id?: string | null;
          responses?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          user_id?: string | null;
          responses?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'participants_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      labels: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          color: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          color?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: string;
          color?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'labels_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      participant_labels: {
        Row: {
          id: string;
          participant_id: string;
          label_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          label_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          participant_id?: string;
          label_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'participant_labels_participant_id_fkey';
            columns: ['participant_id'];
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'participant_labels_label_id_fkey';
            columns: ['label_id'];
            referencedRelation: 'labels';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Helper types for easier access
export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database['public']['Tables'] & Database['public']['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database['public']['Tables'] &
        Database['public']['Views'])
    ? (Database['public']['Tables'] &
        Database['public']['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof Database['public']['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
    ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof Database['public']['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
    ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;
