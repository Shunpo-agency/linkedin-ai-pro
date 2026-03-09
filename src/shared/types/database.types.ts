export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      business_settings: {
        Row: {
          id: string
          user_id: string
          business_name: string | null
          business_description: string | null
          offers: Json
          main_features: Json
          business_model: string | null
          target_persona: Json | null
          ai_behavior: Json | null
          calendar_link: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          business_name?: string | null
          business_description?: string | null
          offers?: Json
          main_features?: Json
          business_model?: string | null
          target_persona?: Json | null
          ai_behavior?: Json | null
          calendar_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          business_name?: string | null
          business_description?: string | null
          offers?: Json
          main_features?: Json
          business_model?: string | null
          target_persona?: Json | null
          ai_behavior?: Json | null
          calendar_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      linkedin_accounts: {
        Row: {
          id: string
          user_id: string
          unipile_account_id: string
          linkedin_profile_url: string | null
          linkedin_name: string | null
          status: string
          connected_at: string
        }
        Insert: {
          id?: string
          user_id: string
          unipile_account_id: string
          linkedin_profile_url?: string | null
          linkedin_name?: string | null
          status?: string
          connected_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          unipile_account_id?: string
          linkedin_profile_url?: string | null
          linkedin_name?: string | null
          status?: string
          connected_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          id: string
          user_id: string
          linkedin_profile_url: string
          linkedin_id: string | null
          first_name: string | null
          last_name: string | null
          job_title: string | null
          company: string | null
          industry: string | null
          location: string | null
          profile_picture_url: string | null
          connection_status: string
          lead_score: number
          temperature: string
          booking_status: string
          calendar_event_url: string | null
          ai_notes: string | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          linkedin_profile_url: string
          linkedin_id?: string | null
          first_name?: string | null
          last_name?: string | null
          job_title?: string | null
          company?: string | null
          industry?: string | null
          location?: string | null
          profile_picture_url?: string | null
          connection_status?: string
          lead_score?: number
          temperature?: string
          booking_status?: string
          calendar_event_url?: string | null
          ai_notes?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          linkedin_profile_url?: string
          linkedin_id?: string | null
          first_name?: string | null
          last_name?: string | null
          job_title?: string | null
          company?: string | null
          industry?: string | null
          location?: string | null
          profile_picture_url?: string | null
          connection_status?: string
          lead_score?: number
          temperature?: string
          booking_status?: string
          calendar_event_url?: string | null
          ai_notes?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          user_id: string
          prospect_id: string
          direction: string
          channel: string
          content: string
          unipile_message_id: string | null
          sent_at: string
          read_at: string | null
          ai_generated: boolean
        }
        Insert: {
          id?: string
          user_id: string
          prospect_id: string
          direction: string
          channel?: string
          content: string
          unipile_message_id?: string | null
          sent_at?: string
          read_at?: string | null
          ai_generated?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          prospect_id?: string
          direction?: string
          channel?: string
          content?: string
          unipile_message_id?: string | null
          sent_at?: string
          read_at?: string | null
          ai_generated?: boolean
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          id: string
          user_id: string
          name: string
          status: string
          persona_snapshot: Json | null
          prospects_count: number
          messages_sent: number
          replies_count: number
          meetings_booked: number
          started_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          status?: string
          persona_snapshot?: Json | null
          prospects_count?: number
          messages_sent?: number
          replies_count?: number
          meetings_booked?: number
          started_at?: string
          ended_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          status?: string
          persona_snapshot?: Json | null
          prospects_count?: number
          messages_sent?: number
          replies_count?: number
          meetings_booked?: number
          started_at?: string
          ended_at?: string | null
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          id: string
          user_id: string
          campaign_id: string | null
          intent_type: string
          status: string
          result: Json | null
          error: string | null
          started_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          campaign_id?: string | null
          intent_type: string
          status?: string
          result?: Json | null
          error?: string | null
          started_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          campaign_id?: string | null
          intent_type?: string
          status?: string
          result?: Json | null
          error?: string | null
          started_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      ai_suggested_replies: {
        Row: {
          id: string
          user_id: string
          prospect_id: string
          inbound_message_id: string | null
          suggested_content: string
          status: string
          final_content: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          prospect_id: string
          inbound_message_id?: string | null
          suggested_content: string
          status?: string
          final_content?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          prospect_id?: string
          inbound_message_id?: string | null
          suggested_content?: string
          status?: string
          final_content?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      intent_signals: {
        Row: {
          id: string
          user_id: string
          prospect_id: string
          signal_type: string
          points: number
          occurred_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          prospect_id: string
          signal_type: string
          points?: number
          occurred_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          prospect_id?: string
          signal_type?: string
          points?: number
          occurred_at?: string
          metadata?: Json | null
        }
        Relationships: []
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
