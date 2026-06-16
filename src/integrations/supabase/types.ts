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
      notify_event_failures: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload_summary: Json | null
          source: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload_summary?: Json | null
          source: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload_summary?: Json | null
          source?: string
        }
        Relationships: []
      }
      phase_updates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          phase_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          phase_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          phase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_updates_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_phases: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          name: string
          project_id: string
          sort_order: number
          started_at: string | null
          status: Database["public"]["Enums"]["phase_status"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          name: string
          project_id: string
          sort_order?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["phase_status"]
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          cover_photo_url: string | null
          created_at: string
          customer_id: string
          expected_end_date: string | null
          id: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_year: string | null
        }
        Insert: {
          cover_photo_url?: string | null
          created_at?: string
          customer_id: string
          expected_end_date?: string | null
          id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: string | null
        }
        Update: {
          cover_photo_url?: string | null
          created_at?: string
          customer_id?: string
          expected_end_date?: string | null
          id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          beschrijving: string | null
          bouwjaar: string | null
          created_at: string
          email: string
          foto_urls: string[] | null
          id: string
          merk: string | null
          model: string | null
          naam: string
          status: Database["public"]["Enums"]["quote_status"]
          telefoon: string | null
          type_werk: string
        }
        Insert: {
          beschrijving?: string | null
          bouwjaar?: string | null
          created_at?: string
          email: string
          foto_urls?: string[] | null
          id?: string
          merk?: string | null
          model?: string | null
          naam: string
          status?: Database["public"]["Enums"]["quote_status"]
          telefoon?: string | null
          type_werk: string
        }
        Update: {
          beschrijving?: string | null
          bouwjaar?: string | null
          created_at?: string
          email?: string
          foto_urls?: string[] | null
          id?: string
          merk?: string | null
          model?: string | null
          naam?: string
          status?: Database["public"]["Enums"]["quote_status"]
          telefoon?: string | null
          type_werk?: string
        }
        Relationships: []
      }
      recent_work_items: {
        Row: {
          caption: string | null
          created_at: string
          date_label: string | null
          id: string
          photo_path: string
          publication_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          date_label?: string | null
          id?: string
          photo_path: string
          publication_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          date_label?: string | null
          id?: string
          photo_path?: string
          publication_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recent_work_items_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "recent_work_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_work_publications: {
        Row: {
          cover_photo_path: string | null
          created_at: string
          id: string
          sort_order: number
          status: Database["public"]["Enums"]["recent_work_status"]
          subtitle: string | null
          title: string
          updated_at: string
          vehicle_label: string | null
          year_label: string | null
        }
        Insert: {
          cover_photo_path?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["recent_work_status"]
          subtitle?: string | null
          title?: string
          updated_at?: string
          vehicle_label?: string | null
          year_label?: string | null
        }
        Update: {
          cover_photo_path?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["recent_work_status"]
          subtitle?: string | null
          title?: string
          updated_at?: string
          vehicle_label?: string | null
          year_label?: string | null
        }
        Relationships: []
      }
      update_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          sort_order: number
          storage_path: string
          update_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path: string
          update_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path?: string
          update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_photos_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "phase_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      dispatch_notify_event: { Args: { _payload: Json }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_project: {
        Args: { _project: string; _uid: string }
        Returns: boolean
      }
      verify_webhook_secret: { Args: { provided: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin"
      phase_status: "pending" | "active" | "done"
      project_status:
        | "intake"
        | "transport_out"
        | "in_workshop"
        | "transport_return"
        | "delivered"
        | "archived"
      quote_status: "new" | "contacted" | "quoted" | "won" | "lost"
      recent_work_status: "draft" | "published"
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
      app_role: ["admin"],
      phase_status: ["pending", "active", "done"],
      project_status: [
        "intake",
        "transport_out",
        "in_workshop",
        "transport_return",
        "delivered",
        "archived",
      ],
      quote_status: ["new", "contacted", "quoted", "won", "lost"],
      recent_work_status: ["draft", "published"],
    },
  },
} as const
