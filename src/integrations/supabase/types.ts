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
      default_room_tasks: {
        Row: {
          applies_to_all_rooms: boolean
          created_at: string
          created_by: string
          description: string
          id: string
          inventory_quantity: number
          inventory_type_id: string | null
          vendor_type_id: string | null
        }
        Insert: {
          applies_to_all_rooms?: boolean
          created_at?: string
          created_by: string
          description: string
          id?: string
          inventory_quantity?: number
          inventory_type_id?: string | null
          vendor_type_id?: string | null
        }
        Update: {
          applies_to_all_rooms?: boolean
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          inventory_quantity?: number
          inventory_type_id?: string | null
          vendor_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "default_room_tasks_inventory_type_id_fkey"
            columns: ["inventory_type_id"]
            isOneToOne: false
            referencedRelation: "inventory_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "default_room_tasks_vendor_type_id_fkey"
            columns: ["vendor_type_id"]
            isOneToOne: false
            referencedRelation: "vendor_types"
            referencedColumns: ["id"]
          },
        ]
      }
      default_task_room_templates: {
        Row: {
          created_at: string
          default_task_id: string
          id: string
          room_template_id: string
        }
        Insert: {
          created_at?: string
          default_task_id: string
          id?: string
          room_template_id: string
        }
        Update: {
          created_at?: string
          default_task_id?: string
          id?: string
          room_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "default_task_room_templates_default_task_id_fkey"
            columns: ["default_task_id"]
            isOneToOne: false
            referencedRelation: "default_room_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "default_task_room_templates_room_template_id_fkey"
            columns: ["room_template_id"]
            isOneToOne: false
            referencedRelation: "room_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      floorplans: {
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
      inspection_runs: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          inspection_id: string
          started_at: string
          started_by: string
          template_id: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          inspection_id: string
          started_at?: string
          started_by: string
          template_id?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          inspection_id?: string
          started_at?: string
          started_by?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_runs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          floorplan_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          floorplan_id?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          floorplan_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_templates_floorplan_id_fkey"
            columns: ["floorplan_id"]
            isOneToOne: false
            referencedRelation: "floorplans"
            referencedColumns: ["id"]
          },
        ]
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
          completed: boolean | null
          completed_by: string | null
          created_at: string
          created_by: string
          date: string
          duration: number | null
          id: string
          inspection_template_id: string | null
          parent_inspection_id: string | null
          property_id: string
          time: string
          type: string
          unit_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          completed?: boolean | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          date: string
          duration?: number | null
          id?: string
          inspection_template_id?: string | null
          parent_inspection_id?: string | null
          property_id: string
          time: string
          type: string
          unit_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          completed?: boolean | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          date?: string
          duration?: number | null
          id?: string
          inspection_template_id?: string | null
          parent_inspection_id?: string | null
          property_id?: string
          time?: string
          type?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_inspection_template_id_fkey"
            columns: ["inspection_template_id"]
            isOneToOne: false
            referencedRelation: "inspection_templates"
            referencedColumns: ["id"]
          },
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
      room_template_items: {
        Row: {
          created_at: string
          description: string
          id: string
          inventory_quantity: number | null
          inventory_type_id: string | null
          order_index: number
          room_template_id: string
          vendor_type_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          inventory_quantity?: number | null
          inventory_type_id?: string | null
          order_index?: number
          room_template_id: string
          vendor_type_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          inventory_quantity?: number | null
          inventory_type_id?: string | null
          order_index?: number
          room_template_id?: string
          vendor_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_template_items_inventory_type_id_fkey"
            columns: ["inventory_type_id"]
            isOneToOne: false
            referencedRelation: "inventory_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_template_items_room_template_id_fkey"
            columns: ["room_template_id"]
            isOneToOne: false
            referencedRelation: "room_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_template_items_vendor_type_id_fkey"
            columns: ["vendor_type_id"]
            isOneToOne: false
            referencedRelation: "vendor_types"
            referencedColumns: ["id"]
          },
        ]
      }
      room_templates: {
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
      subtask_activity: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
          subtask_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          created_by: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          subtask_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          subtask_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtask_activity_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "subtasks"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          assigned_users: string[] | null
          attachment_url: string | null
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          inspection_id: string
          inspection_run_id: string | null
          inventory_quantity: number | null
          inventory_type_id: string | null
          original_inspection_id: string
          room_name: string | null
          status: string | null
          status_changed_at: string | null
          status_changed_by: string | null
          vendor_type_id: string | null
        }
        Insert: {
          assigned_users?: string[] | null
          attachment_url?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          inspection_id: string
          inspection_run_id?: string | null
          inventory_quantity?: number | null
          inventory_type_id?: string | null
          original_inspection_id: string
          room_name?: string | null
          status?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          vendor_type_id?: string | null
        }
        Update: {
          assigned_users?: string[] | null
          attachment_url?: string | null
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          inspection_id?: string
          inspection_run_id?: string | null
          inventory_quantity?: number | null
          inventory_type_id?: string | null
          original_inspection_id?: string
          room_name?: string | null
          status?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          vendor_type_id?: string | null
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
            foreignKeyName: "subtasks_inspection_run_id_fkey"
            columns: ["inspection_run_id"]
            isOneToOne: false
            referencedRelation: "inspection_runs"
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
          {
            foreignKeyName: "subtasks_vendor_type_id_fkey"
            columns: ["vendor_type_id"]
            isOneToOne: false
            referencedRelation: "vendor_types"
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
          source_room_template_item_id: string | null
          vendor_type_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          inventory_quantity?: number | null
          inventory_type_id?: string | null
          order_index?: number
          room_id: string
          source_room_template_item_id?: string | null
          vendor_type_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          inventory_quantity?: number | null
          inventory_type_id?: string | null
          order_index?: number
          room_id?: string
          source_room_template_item_id?: string | null
          vendor_type_id?: string | null
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
          {
            foreignKeyName: "template_items_source_room_template_item_id_fkey"
            columns: ["source_room_template_item_id"]
            isOneToOne: false
            referencedRelation: "room_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_items_vendor_type_id_fkey"
            columns: ["vendor_type_id"]
            isOneToOne: false
            referencedRelation: "vendor_types"
            referencedColumns: ["id"]
          },
        ]
      }
      template_properties: {
        Row: {
          created_at: string
          id: string
          property_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_properties_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_templates"
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
          room_template_id: string | null
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          room_template_id?: string | null
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          room_template_id?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_rooms_room_template_id_fkey"
            columns: ["room_template_id"]
            isOneToOne: false
            referencedRelation: "room_templates"
            referencedColumns: ["id"]
          },
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
          floorplan_id: string | null
          id: string
          name: string
          property_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          floorplan_id?: string | null
          id?: string
          name: string
          property_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          floorplan_id?: string | null
          id?: string
          name?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_floorplan_id_fkey"
            columns: ["floorplan_id"]
            isOneToOne: false
            referencedRelation: "floorplans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_types: {
        Row: {
          created_at: string
          created_by: string
          default_assigned_user_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_assigned_user_id?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_assigned_user_id?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
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
