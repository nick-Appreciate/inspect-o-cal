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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      inspection_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          type: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      inspection_types: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      inspections: {
        Row: {
          attachment_url: string | null
          created_at: string
          created_by: string
          date: string
          duration: number | null
          id: string
          parent_inspection_id: string | null
          property_id: string
          time: string
          type: string
          unit_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          created_by: string
          date: string
          duration?: number | null
          id?: string
          parent_inspection_id?: string | null
          property_id: string
          time: string
          type: string
          unit_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string
          date?: string
          duration?: number | null
          id?: string
          parent_inspection_id?: string | null
          property_id?: string
          time?: string
          type?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_parent_inspection_id_fkey"
            columns: ["parent_inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_types: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          address: string
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          address?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          assigned_users: string[] | null
          attachment_url: string | null
          completed: boolean | null
          created_at: string
          created_by: string
          description: string
          id: string
          inspection_id: string
          inventory_quantity: number | null
          inventory_type_id: string | null
          original_inspection_id: string
        }
        Insert: {
          assigned_users?: string[] | null
          attachment_url?: string | null
          completed?: boolean | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          inspection_id: string
          inventory_quantity?: number | null
          inventory_type_id?: string | null
          original_inspection_id: string
        }
        Update: {
          assigned_users?: string[] | null
          attachment_url?: string | null
          completed?: boolean | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          inspection_id?: string
          inventory_quantity?: number | null
          inventory_type_id?: string | null
          original_inspection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_inventory_type_id_fkey"
            columns: ["inventory_type_id"]
            isOneToOne: false
            referencedRelation: "inventory_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_original_inspection_id_fkey"
            columns: ["original_inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      template_items: {
        Row: {
          created_at: string
          description: string
          id: string
          inventory_quantity: number | null
          inventory_type_id: string | null
          order_index: number
          room_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          inventory_quantity?: number | null
          inventory_type_id?: string | null
          order_index?: number
          room_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          inventory_quantity?: number | null
          inventory_type_id?: string | null
          order_index?: number
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_items_inventory_type_id_fkey"
            columns: ["inventory_type_id"]
            isOneToOne: false
            referencedRelation: "inventory_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_items_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "template_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      template_rooms: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_rooms_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          property_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          property_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
