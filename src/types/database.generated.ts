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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      companies: {
        Row: {
          city: string | null
          collected_at: string
          country: string
          created_at: string
          detected_stack: string[]
          finances_year: number | null
          founded_on: string | null
          headcount_code: string | null
          icp_profile_id: string | null
          id: string
          last_interaction_at: string | null
          legal_form: string | null
          naf_code: string | null
          name: string
          net_income: number | null
          notes: string | null
          origin: string
          postal_code: string | null
          registration_id: string | null
          revenue: number | null
          score: number | null
          scored_at: string | null
          sector: string | null
          size_category: string | null
          source_id: string | null
          stack_detected_at: string | null
          stage_id: string | null
          updated_at: string
          user_id: string
          website: string | null
          website_domain: string | null
        }
        Insert: {
          city?: string | null
          collected_at?: string
          country?: string
          created_at?: string
          detected_stack?: string[]
          finances_year?: number | null
          founded_on?: string | null
          headcount_code?: string | null
          icp_profile_id?: string | null
          id?: string
          last_interaction_at?: string | null
          legal_form?: string | null
          naf_code?: string | null
          name: string
          net_income?: number | null
          notes?: string | null
          origin?: string
          postal_code?: string | null
          registration_id?: string | null
          revenue?: number | null
          score?: number | null
          scored_at?: string | null
          sector?: string | null
          size_category?: string | null
          source_id?: string | null
          stack_detected_at?: string | null
          stage_id?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          website_domain?: string | null
        }
        Update: {
          city?: string | null
          collected_at?: string
          country?: string
          created_at?: string
          detected_stack?: string[]
          finances_year?: number | null
          founded_on?: string | null
          headcount_code?: string | null
          icp_profile_id?: string | null
          id?: string
          last_interaction_at?: string | null
          legal_form?: string | null
          naf_code?: string | null
          name?: string
          net_income?: number | null
          notes?: string | null
          origin?: string
          postal_code?: string | null
          registration_id?: string | null
          revenue?: number | null
          score?: number | null
          scored_at?: string | null
          sector?: string | null
          size_category?: string | null
          source_id?: string | null
          stack_detected_at?: string | null
          stage_id?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          website_domain?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_icp_profile_id_user_id_fkey"
            columns: ["icp_profile_id", "user_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "companies_source_id_user_id_fkey"
            columns: ["source_id", "user_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "companies_stage_id_user_id_fkey"
            columns: ["stage_id", "user_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      company_contacts: {
        Row: {
          collected_at: string
          company_id: string
          created_at: string
          data_source: string
          email: string | null
          email_confidence: number | null
          email_source: string | null
          first_name: string | null
          id: string
          is_decision_maker: boolean
          last_name: string | null
          linkedin_url: string | null
          notes: string | null
          opted_out_at: string | null
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          collected_at?: string
          company_id: string
          created_at?: string
          data_source?: string
          email?: string | null
          email_confidence?: number | null
          email_source?: string | null
          first_name?: string | null
          id?: string
          is_decision_maker?: boolean
          last_name?: string | null
          linkedin_url?: string | null
          notes?: string | null
          opted_out_at?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          collected_at?: string
          company_id?: string
          created_at?: string
          data_source?: string
          email?: string | null
          email_confidence?: number | null
          email_source?: string | null
          first_name?: string | null
          id?: string
          is_decision_maker?: boolean
          last_name?: string | null
          linkedin_url?: string | null
          notes?: string | null
          opted_out_at?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_user_id_fkey"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      company_interactions: {
        Row: {
          company_id: string
          contact_id: string | null
          content: string | null
          created_at: string
          direction: string | null
          duration_seconds: number | null
          id: string
          occurred_at: string
          status: string
          subject: string | null
          type: string
          user_id: string
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          content?: string | null
          created_at?: string
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          occurred_at?: string
          status?: string
          subject?: string | null
          type: string
          user_id: string
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          content?: string | null
          created_at?: string
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          occurred_at?: string
          status?: string
          subject?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_interactions_company_id_user_id_fkey"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "company_interactions_contact_id_company_id_fkey"
            columns: ["contact_id", "company_id"]
            isOneToOne: false
            referencedRelation: "company_contacts"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      company_qualifications: {
        Row: {
          company_id: string
          created_at: string
          elimination_reason: string | null
          icp_profile_id: string
          icp_version: number
          id: string
          is_eliminated: boolean
          model: string | null
          reasons: Json
          score: number
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          elimination_reason?: string | null
          icp_profile_id: string
          icp_version: number
          id?: string
          is_eliminated?: boolean
          model?: string | null
          reasons?: Json
          score: number
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          elimination_reason?: string | null
          icp_profile_id?: string
          icp_version?: number
          id?: string
          is_eliminated?: boolean
          model?: string | null
          reasons?: Json
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_qualifications_company_id_user_id_fkey"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "company_qualifications_icp_profile_id_user_id_fkey"
            columns: ["icp_profile_id", "user_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      company_signals: {
        Row: {
          company_id: string
          created_at: string
          dedupe_key: string | null
          detected_at: string
          evidence: Json
          expires_at: string | null
          id: string
          signal_type: string
          source_url: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          dedupe_key?: string | null
          detected_at?: string
          evidence?: Json
          expires_at?: string | null
          id?: string
          signal_type: string
          source_url?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          dedupe_key?: string | null
          detected_at?: string
          evidence?: Json
          expires_at?: string | null
          id?: string
          signal_type?: string
          source_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_signals_company_id_user_id_fkey"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "company_signals_signal_type_fkey"
            columns: ["signal_type"]
            isOneToOne: false
            referencedRelation: "signal_types"
            referencedColumns: ["key"]
          },
        ]
      }
      icp_profiles: {
        Row: {
          created_at: string
          criteria: Json
          id: string
          is_active: boolean
          name: string
          profession_key: string | null
          signal_weights: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          criteria?: Json
          id?: string
          is_active?: boolean
          name: string
          profession_key?: string | null
          signal_weights?: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          criteria?: Json
          id?: string
          is_active?: boolean
          name?: string
          profession_key?: string | null
          signal_weights?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "icp_profiles_profession_key_fkey"
            columns: ["profession_key"]
            isOneToOne: false
            referencedRelation: "professions"
            referencedColumns: ["key"]
          },
        ]
      }
      lead_sources: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          order: number
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          order?: number
          user_id?: string
        }
        Relationships: []
      }
      pipeline_runs: {
        Row: {
          companies_created: number
          companies_seen: number
          companies_skipped: number
          details: Json
          error: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          triggered_by: string
          user_id: string
        }
        Insert: {
          companies_created?: number
          companies_seen?: number
          companies_skipped?: number
          details?: Json
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by: string
          user_id: string
        }
        Update: {
          companies_created?: number
          companies_seen?: number
          companies_skipped?: number
          details?: Json
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by?: string
          user_id?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_default: boolean
          kind: string
          name: string
          order: number
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name: string
          order: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          order?: number
          user_id?: string
        }
        Relationships: []
      }
      portfolio_references: {
        Row: {
          client_name: string | null
          created_at: string
          id: string
          is_client_name_public: boolean
          naf_code: string | null
          sector: string | null
          summary: string
          technologies: string[]
          title: string
          updated_at: string
          url: string | null
          user_id: string
          year: number | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          id?: string
          is_client_name_public?: boolean
          naf_code?: string | null
          sector?: string | null
          summary: string
          technologies?: string[]
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          client_name?: string | null
          created_at?: string
          id?: string
          is_client_name_public?: boolean
          naf_code?: string | null
          sector?: string | null
          summary?: string
          technologies?: string[]
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      profession_signals: {
        Row: {
          default_weight: number
          profession_key: string
          signal_type: string
        }
        Insert: {
          default_weight?: number
          profession_key: string
          signal_type: string
        }
        Update: {
          default_weight?: number
          profession_key?: string
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "profession_signals_profession_key_fkey"
            columns: ["profession_key"]
            isOneToOne: false
            referencedRelation: "professions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "profession_signals_signal_type_fkey"
            columns: ["signal_type"]
            isOneToOne: false
            referencedRelation: "signal_types"
            referencedColumns: ["key"]
          },
        ]
      }
      professions: {
        Row: {
          created_at: string
          default_icp: Json
          description: string | null
          is_active: boolean
          key: string
          label: string
          order: number
          target_roles: string[]
        }
        Insert: {
          created_at?: string
          default_icp?: Json
          description?: string | null
          is_active?: boolean
          key: string
          label: string
          order?: number
          target_roles?: string[]
        }
        Update: {
          created_at?: string
          default_icp?: Json
          description?: string | null
          is_active?: boolean
          key?: string
          label?: string
          order?: number
          target_roles?: string[]
        }
        Relationships: []
      }
      prospection_settings: {
        Row: {
          bodacc_cursor: string | null
          created_at: string
          days_of_week: number[]
          departments: string[]
          excluded_naf_sections: string[]
          is_active: boolean
          job_postings_cursor: string | null
          max_companies_per_run: number
          next_run_at: string | null
          run_hour: number
          sources: string[]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bodacc_cursor?: string | null
          created_at?: string
          days_of_week?: number[]
          departments?: string[]
          excluded_naf_sections?: string[]
          is_active?: boolean
          job_postings_cursor?: string | null
          max_companies_per_run?: number
          next_run_at?: string | null
          run_hour?: number
          sources?: string[]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bodacc_cursor?: string | null
          created_at?: string
          days_of_week?: number[]
          departments?: string[]
          excluded_naf_sections?: string[]
          is_active?: boolean
          job_postings_cursor?: string | null
          max_companies_per_run?: number
          next_run_at?: string | null
          run_hour?: number
          sources?: string[]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          company_id: string | null
          completed_at: string | null
          created_at: string | null
          due_at: string
          id: string
          priority: string | null
          title: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          due_at: string
          id?: string
          priority?: string | null
          title: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          due_at?: string
          id?: string
          priority?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_company_fkey"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      signal_types: {
        Row: {
          created_at: string
          default_ttl_days: number | null
          description: string | null
          is_active: boolean
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          default_ttl_days?: number | null
          description?: string | null
          is_active?: boolean
          key: string
          label: string
        }
        Update: {
          created_at?: string
          default_ttl_days?: number | null
          description?: string | null
          is_active?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
      unidentified_job_offers: {
        Row: {
          company_id: string | null
          contract_type: string | null
          created_at: string
          description: string | null
          external_id: string
          id: string
          location: string | null
          published_at: string | null
          signal_type: string
          source: string
          status: string
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          contract_type?: string | null
          created_at?: string
          description?: string | null
          external_id: string
          id?: string
          location?: string | null
          published_at?: string | null
          signal_type: string
          source?: string
          status?: string
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          contract_type?: string | null
          created_at?: string
          description?: string | null
          external_id?: string
          id?: string
          location?: string | null
          published_at?: string | null
          signal_type?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidentified_job_offers_company_id_user_id_fkey"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "unidentified_job_offers_signal_type_fkey"
            columns: ["signal_type"]
            isOneToOne: false
            referencedRelation: "signal_types"
            referencedColumns: ["key"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          business_name: string | null
          created_at: string | null
          first_name: string | null
          id: string
          onboarding_completed: boolean | null
          profession_key: string | null
          selected_theme: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string | null
          first_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          profession_key?: string | null
          selected_theme?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          profession_key?: string | null
          selected_theme?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_profession_key_fkey"
            columns: ["profession_key"]
            isOneToOne: false
            referencedRelation: "professions"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_due_prospection_runs: {
        Args: { p_limit?: number }
        Returns: string[]
      }
      compute_company_score: {
        Args: { p_company_id: string }
        Returns: {
          elimination_reason: string
          icp_profile_id: string
          is_eliminated: boolean
          reasons: Json
          score: number
        }[]
      }
      compute_next_prospection_run: {
        Args: {
          p_after: string
          p_days: number[]
          p_hour: number
          p_tz: string
        }
        Returns: string
      }
      initialize_prospection_defaults: { Args: never; Returns: undefined }
      rescore_companies_with_expired_signals: { Args: never; Returns: number }
      score_company: { Args: { p_company_id: string }; Returns: undefined }
      sync_tech_stack_signal: {
        Args: { p_company_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          lifecycle_configuration: Json | null
          lifecycle_configuration_generation: string | null
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
          versioning_status: string
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          lifecycle_configuration?: Json | null
          lifecycle_configuration_generation?: string | null
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          lifecycle_configuration?: Json | null
          lifecycle_configuration_generation?: string | null
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          archived_at: string | null
          bucket_id: string | null
          created_at: string | null
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: { delete_markers?: string; noncurrent_versions?: string }
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
          raw_prefix_param?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delete_markers?: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          next_token_archived_at?: string
          next_token_version?: string
          noncurrent_versions?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          delete_markers?: string
          levels?: number
          limits?: number
          noncurrent_versions?: string
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          delete_markers?: string
          noncurrent_versions?: string
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
          p_start_after_version?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          delete_markers?: string
          levels?: number
          limits?: number
          noncurrent_versions?: string
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
          start_after_archived_at?: string
          start_after_is_continuation?: boolean
          start_after_version?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
