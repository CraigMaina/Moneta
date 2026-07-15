export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          amount_cents: number
          category_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          category_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          category_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          archived_at: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["account_type"]
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          type: Database["public"]["Enums"]["account_type"]
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["account_type"]
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          created_at: string
          id: string
          progress: number
          target: number
          type: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          progress?: number
          target: number
          type: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          progress?: number
          target?: number
          type?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      goal_contributions: {
        Row: {
          amount_cents: number
          created_at: string
          goal_id: string
          id: string
          occurred_at: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          goal_id: string
          id?: string
          occurred_at?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          goal_id?: string
          id?: string
          occurred_at?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          achieved_at: string | null
          created_at: string
          emoji: string | null
          id: string
          name: string
          photo_url: string | null
          target_cents: number
          target_date: string | null
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          photo_url?: string | null
          target_cents: number
          target_date?: string | null
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          target_cents?: number
          target_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      merchant_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          merchant_normalized: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          merchant_normalized: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          merchant_normalized?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          consent_flags: Json
          created_at: string
          cycle_anchor_day: number
          display_name: string | null
          expected_income_cents: number
          id: string
          notification_prefs: Json
          pin_hash: string | null
          user_id: string
        }
        Insert: {
          consent_flags?: Json
          created_at?: string
          cycle_anchor_day?: number
          display_name?: string | null
          expected_income_cents?: number
          id?: string
          notification_prefs?: Json
          pin_hash?: string | null
          user_id: string
        }
        Update: {
          consent_flags?: Json
          created_at?: string
          cycle_anchor_day?: number
          display_name?: string | null
          expected_income_cents?: number
          id?: string
          notification_prefs?: Json
          pin_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recurring_items: {
        Row: {
          account_id: string
          amount_cents: number
          autopay: boolean
          cadence: string
          category_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          merchant: string | null
          next_due_date: string
          note: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          autopay?: boolean
          cadence: string
          category_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          merchant?: string | null
          next_due_date: string
          note?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          autopay?: boolean
          cadence?: string
          category_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          merchant?: string | null
          next_due_date?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          created_at: string
          current_count: number
          freezes_used_this_week: number
          id: string
          last_counted_date: string | null
          longest_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          current_count?: number
          freezes_used_this_week?: number
          id?: string
          last_counted_date?: string | null
          longest_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          current_count?: number
          freezes_used_this_week?: number
          id?: string
          last_counted_date?: string | null
          longest_count?: number
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount_cents: number
          category_id: string | null
          counter_account_id: string | null
          created_at: string
          fee_cents: number | null
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          merchant: string | null
          mpesa_ref: string | null
          note: string | null
          occurred_at: string
          parser_version: string | null
          raw_sms: string | null
          source: Database["public"]["Enums"]["transaction_source"]
          user_id: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          category_id?: string | null
          counter_account_id?: string | null
          created_at?: string
          fee_cents?: number | null
          id?: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          merchant?: string | null
          mpesa_ref?: string | null
          note?: string | null
          occurred_at?: string
          parser_version?: string | null
          raw_sms?: string | null
          source?: Database["public"]["Enums"]["transaction_source"]
          user_id: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          category_id?: string | null
          counter_account_id?: string | null
          created_at?: string
          fee_cents?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          merchant?: string | null
          mpesa_ref?: string | null
          note?: string | null
          occurred_at?: string
          parser_version?: string | null
          raw_sms?: string | null
          source?: Database["public"]["Enums"]["transaction_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_counter_account_id_fkey"
            columns: ["counter_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_counter_account_id_fkey"
            columns: ["counter_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          account_name: string | null
          balance_cents: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type: "mpesa" | "cash" | "bank" | "other"
      category_kind: "income" | "expense"
      transaction_kind: "income" | "expense" | "transfer"
      transaction_source: "manual" | "sms_parse" | "statement_import"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["mpesa", "cash", "bank", "other"],
      category_kind: ["income", "expense"],
      transaction_kind: ["income", "expense", "transfer"],
      transaction_source: ["manual", "sms_parse", "statement_import"],
    },
  },
} as const
