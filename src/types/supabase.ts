export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
      events: {
        Row: {
          created_at: string;
          custom_fields: Json;
          datetime: string | null;
          description: string | null;
          end_datetime: string | null;
          group_id: string | null;
          id: string;
          is_private: boolean;
          location: string | null;
          max_participants: number | null;
          name: string;
          organizer_id: string;
          parent_event_id: string | null;
        };
        Insert: {
          created_at?: string;
          custom_fields?: Json;
          datetime?: string | null;
          description?: string | null;
          end_datetime?: string | null;
          group_id?: string | null;
          id?: string;
          is_private?: boolean;
          location?: string | null;
          max_participants?: number | null;
          name: string;
          organizer_id: string;
          parent_event_id?: string | null;
        };
        Update: {
          created_at?: string;
          custom_fields?: Json;
          datetime?: string | null;
          description?: string | null;
          end_datetime?: string | null;
          group_id?: string | null;
          id?: string;
          is_private?: boolean;
          location?: string | null;
          max_participants?: number | null;
          name?: string;
          organizer_id?: string;
          parent_event_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_organizer_id_fkey';
            columns: ['organizer_id'];
            isOneToOne: false;
            referencedRelation: 'organizers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      group_admins: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_admins_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_admins_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'organizers';
            referencedColumns: ['id'];
          },
        ];
      };
      group_participants: {
        Row: {
          group_id: string;
          guest_email: string | null;
          id: string;
          joined_at: string;
          participant_id: string;
          user_id: string | null;
        };
        Insert: {
          group_id: string;
          guest_email?: string | null;
          id?: string;
          joined_at?: string;
          participant_id: string;
          user_id?: string | null;
        };
        Update: {
          group_id?: string;
          guest_email?: string | null;
          id?: string;
          joined_at?: string;
          participant_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'group_participants_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_participants_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_private: boolean;
          name: string;
          organizer_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_private?: boolean;
          name: string;
          organizer_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_private?: boolean;
          name?: string;
          organizer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'groups_organizer_id_fkey';
            columns: ['organizer_id'];
            isOneToOne: false;
            referencedRelation: 'organizers';
            referencedColumns: ['id'];
          },
        ];
      };
      labels: {
        Row: {
          color: string | null;
          event_id: string;
          id: string;
          name: string;
        };
        Insert: {
          color?: string | null;
          event_id: string;
          id?: string;
          name: string;
        };
        Update: {
          color?: string | null;
          event_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'labels_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      organizers: {
        Row: {
          created_at: string | null;
          id: string;
          name: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string | null;
        };
        Relationships: [];
      };
      participant_labels: {
        Row: {
          created_at: string;
          id: string;
          label_id: string;
          participant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label_id: string;
          participant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label_id?: string;
          participant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'participant_labels_label_id_fkey';
            columns: ['label_id'];
            isOneToOne: false;
            referencedRelation: 'labels';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'participant_labels_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'participants';
            referencedColumns: ['id'];
          },
        ];
      };
      participants: {
        Row: {
          claimed_by_user_id: string | null;
          created_at: string;
          email: string | null;
          event_id: string;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          responses: Json;
          slot_number: number;
          user_id: string | null;
        };
        Insert: {
          claimed_by_user_id?: string | null;
          created_at?: string;
          email?: string | null;
          event_id: string;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          responses?: Json;
          slot_number: number;
          user_id?: string | null;
        };
        Update: {
          claimed_by_user_id?: string | null;
          created_at?: string;
          email?: string | null;
          event_id?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          responses?: Json;
          slot_number?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'participants_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_next_slot_number: {
        Args: { p_event_id: string; p_user_id?: string };
        Returns: number;
      };
      nanoid: {
        Args: { size?: number };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
