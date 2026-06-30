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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          admin_last_seen_at: string | null
          contact_profile_id: string
          created_at: string
          customer_last_seen_at: string | null
          id: string
          last_message_at: string
          project_id: string | null
          source: Database["public"]["Enums"]["conversation_source"]
          status: Database["public"]["Enums"]["conversation_status"]
          subject: string | null
        }
        Insert: {
          admin_last_seen_at?: string | null
          contact_profile_id: string
          created_at?: string
          customer_last_seen_at?: string | null
          id?: string
          last_message_at?: string
          project_id?: string | null
          source?: Database["public"]["Enums"]["conversation_source"]
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
        }
        Update: {
          admin_last_seen_at?: string | null
          contact_profile_id?: string
          created_at?: string
          customer_last_seen_at?: string | null
          id?: string
          last_message_at?: string
          project_id?: string | null
          source?: Database["public"]["Enums"]["conversation_source"]
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_profile_id_fkey"
            columns: ["contact_profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          author_id: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender: Database["public"]["Enums"]["message_sender"]
          source_reaction_id: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender: Database["public"]["Enums"]["message_sender"]
          source_reaction_id?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender?: Database["public"]["Enums"]["message_sender"]
          source_reaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_source_reaction_id_fkey"
            columns: ["source_reaction_id"]
            isOneToOne: false
            referencedRelation: "update_reactions"
            referencedColumns: ["id"]
          },
        ]
      }
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
          locale: Database["public"]["Enums"]["app_locale"]
          password_set: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          locale?: Database["public"]["Enums"]["app_locale"]
          password_set?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["app_locale"]
          password_set?: boolean
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
          admin_last_seen_reactions_at: string
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
          admin_last_seen_reactions_at?: string
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
          admin_last_seen_reactions_at?: string
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
      public_form_submissions: {
        Row: {
          created_at: string
          id: number
          ip: string
          kind: string
        }
        Insert: {
          created_at?: string
          id?: number
          ip: string
          kind: string
        }
        Update: {
          created_at?: string
          id?: number
          ip?: string
          kind?: string
        }
        Relationships: []
      }
      quote_lines: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          quote_id: string
          sort_order: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          quote_id: string
          sort_order?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          quote_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
          locale: Database["public"]["Enums"]["app_locale"]
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
          locale?: Database["public"]["Enums"]["app_locale"]
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
          locale?: Database["public"]["Enums"]["app_locale"]
          merk?: string | null
          model?: string | null
          naam?: string
          status?: Database["public"]["Enums"]["quote_status"]
          telefoon?: string | null
          type_werk?: string
        }
        Relationships: []
      }
      quote_upload_tickets: {
        Row: {
          consumed_at: string | null
          created_at: string
          id: string
          ip: string | null
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          id: string
          ip?: string | null
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          id?: string
          ip?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          intro_text: string
          notes_text: string
          quote_number: string | null
          quote_request_id: string | null
          reminder_sent_at: string | null
          responded_at: string | null
          response_reason: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_doc_status"]
          title: string
          total_amount: number
          updated_at: string
          valid_until: string | null
          vehicle_label: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          intro_text?: string
          notes_text?: string
          quote_number?: string | null
          quote_request_id?: string | null
          reminder_sent_at?: string | null
          responded_at?: string | null
          response_reason?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_doc_status"]
          title?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          vehicle_label?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          intro_text?: string
          notes_text?: string
          quote_number?: string | null
          quote_request_id?: string | null
          reminder_sent_at?: string | null
          responded_at?: string | null
          response_reason?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_doc_status"]
          title?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          vehicle_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_work_items: {
        Row: {
          caption: string | null
          created_at: string
          date_label: string | null
          id: string
          media_type: string
          photo_path: string
          poster_path: string | null
          publication_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          date_label?: string | null
          id?: string
          media_type?: string
          photo_path: string
          poster_path?: string | null
          publication_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          date_label?: string | null
          id?: string
          media_type?: string
          photo_path?: string
          poster_path?: string | null
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      update_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          media_type: string
          poster_path: string | null
          sort_order: number
          storage_path: string
          update_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          media_type?: string
          poster_path?: string | null
          sort_order?: number
          storage_path: string
          update_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          media_type?: string
          poster_path?: string | null
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
      update_reactions: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          phase_update_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          phase_update_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          phase_update_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_reactions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "update_reactions_phase_update_id_fkey"
            columns: ["phase_update_id"]
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      dispatch_notify_event: { Args: { _payload: Json }; Returns: undefined }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_project_reactions_seen: {
        Args: { _project_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_quote_number: { Args: never; Returns: string }
      owns_project: {
        Args: { _project: string; _uid: string }
        Returns: boolean
      }
      quote_upload_ticket_valid: { Args: { _id: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      unread_customer_reactions: {
        Args: { _project_ids: string[] }
        Returns: {
          project_id: string
          unread_count: number
        }[]
      }
      verify_webhook_secret: { Args: { provided: string }; Returns: boolean }
    }
    Enums: {
      app_locale: "nl" | "en"
      app_role: "admin"
      conversation_source: "contact_form" | "quote_request" | "manual"
      conversation_status: "open" | "gesloten"
      message_sender: "klant" | "admin" | "systeem"
      phase_status: "pending" | "active" | "done"
      project_status:
        | "intake"
        | "transport_out"
        | "in_workshop"
        | "transport_return"
        | "delivered"
        | "archived"
      quote_doc_status: "concept" | "verstuurd" | "akkoord" | "afgewezen"
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
      app_locale: ["nl", "en"],
      app_role: ["admin"],
      conversation_source: ["contact_form", "quote_request", "manual"],
      conversation_status: ["open", "gesloten"],
      message_sender: ["klant", "admin", "systeem"],
      phase_status: ["pending", "active", "done"],
      project_status: [
        "intake",
        "transport_out",
        "in_workshop",
        "transport_return",
        "delivered",
        "archived",
      ],
      quote_doc_status: ["concept", "verstuurd", "akkoord", "afgewezen"],
      quote_status: ["new", "contacted", "quoted", "won", "lost"],
      recent_work_status: ["draft", "published"],
    },
  },
} as const
