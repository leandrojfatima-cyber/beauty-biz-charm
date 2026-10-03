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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          client_id: string | null
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          owner_id: string
          professional_id: string
          service_id: string | null
          starts_at: string
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          owner_id?: string
          professional_id: string
          service_id?: string | null
          starts_at: string
          status?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          professional_id?: string
          service_id?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          device: string | null
          email: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          device?: string | null
          email?: string | null
          id?: string
          user_id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          device?: string | null
          email?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          commission_pct: number
          created_at: string
          description: string
          id: string
          kind: string
          order_id: string
          owner_id: string
          product_id: string | null
          professional_id: string | null
          qty: number
          service_id: string | null
          unit_price: number
        }
        Insert: {
          commission_pct?: number
          created_at?: string
          description: string
          id?: string
          kind: string
          order_id: string
          owner_id?: string
          product_id?: string | null
          professional_id?: string | null
          qty?: number
          service_id?: string | null
          unit_price?: number
        }
        Update: {
          commission_pct?: number
          created_at?: string
          description?: string
          id?: string
          kind?: string
          order_id?: string
          owner_id?: string
          product_id?: string | null
          professional_id?: string | null
          qty?: number
          service_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          closed_at: string | null
          discount: number
          id: string
          number: number
          opened_at: string
          owner_id: string
          payment_method: string | null
          status: string
          total: number
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          discount?: number
          id?: string
          number?: number
          opened_at?: string
          owner_id?: string
          payment_method?: string | null
          status?: string
          total?: number
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          discount?: number
          id?: string
          number?: number
          opened_at?: string
          owner_id?: string
          payment_method?: string | null
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          id: string
          installment_price: number
          installments: number
          name: string
          optional: boolean
          price: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          installment_price?: number
          installments?: number
          name: string
          optional?: boolean
          price?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          installment_price?: number
          installments?: number
          name?: string
          optional?: boolean
          price?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          commission_pct: number
          cost: number
          created_at: string
          for_sale: boolean
          id: string
          min_stock: number
          name: string
          owner_id: string
          price: number
          sku: string | null
          stock: number
        }
        Insert: {
          active?: boolean
          commission_pct?: number
          cost?: number
          created_at?: string
          for_sale?: boolean
          id?: string
          min_stock?: number
          name: string
          owner_id?: string
          price?: number
          sku?: string | null
          stock?: number
        }
        Update: {
          active?: boolean
          commission_pct?: number
          cost?: number
          created_at?: string
          for_sale?: boolean
          id?: string
          min_stock?: number
          name?: string
          owner_id?: string
          price?: number
          sku?: string | null
          stock?: number
        }
        Relationships: []
      }
      professionals: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          owner_id: string
          phone: string | null
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          phone?: string | null
          role?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          category: string
          commission_pct: number
          created_at: string
          duration_min: number
          id: string
          name: string
          owner_id: string
          price: number
        }
        Insert: {
          active?: boolean
          category?: string
          commission_pct?: number
          created_at?: string
          duration_min?: number
          id?: string
          name: string
          owner_id?: string
          price?: number
        }
        Update: {
          active?: boolean
          category?: string
          commission_pct?: number
          created_at?: string
          duration_min?: number
          id?: string
          name?: string
          owner_id?: string
          price?: number
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          note: string | null
          owner_id: string
          product_id: string
          qty: number
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          product_id: string
          qty: number
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          product_id?: string
          qty?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          order_id: string | null
          owner_id: string
          type: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          date?: string
          description: string
          id?: string
          order_id?: string | null
          owner_id?: string
          type: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_master: { Args: never; Returns: boolean }
      close_order: {
        Args: { _order_id: string; _payment_method: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "master"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["master"],
    },
  },
} as const
