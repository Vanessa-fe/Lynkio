/**
 * Types de la base, à utiliser partout dans l'application.
 *
 * `database.generated.ts` est produit par `npm run supabase:generate-types` et ne doit pas
 * être modifié à la main. La génération ne connaît pas les contraintes CHECK : les colonnes
 * à valeurs fixes y sont de simples `string`. On les précise ici, en gardant la nullabilité
 * réelle de chaque colonne.
 */
import type { MergeDeep } from 'type-fest'
import type { Database as GeneratedDatabase } from './database.generated'
import type {
  CompanyInteractionStatus,
  CompanyInteractionType,
  CompanyKind,
  CompanySegment,
  CompanySegmentSetBy,
  CompanyOrigin,
  EmailSource,
  InteractionDirection,
  LinkedinPostStatus,
  LinkedinSequenceStatus,
  OutreachStatus,
  PipelineRunStatus,
  PipelineRunTrigger,
  PipelineStageKind,
  PipelineStageRole,
  ReminderPriority,
  SizeCategory,
} from './models'

export type { Json } from './database.generated'

// Même surcharge pour Row, Insert et Update : les champs d'Insert et d'Update
// restent optionnels, car MergeDeep conserve le modificateur `?` d'origine.
type Columns<T> = { Row: T; Insert: Partial<T>; Update: Partial<T> }

export type SophieFrequency = 'off' | 'daily' | 'weekly'
export type DigestCounts = { outgoing: number; incoming: number; meetings: number; notes: number }
type SophieNotification = {
  id: string; user_id: string; kind: 'signal' | 'digest'; delivery_key: string; created_at: string
  read_at: string | null; company_id: string | null; signal_id: string | null; title: string
  source: string; source_url: string | null; detected_at: string | null; event_at: string | null
  period_start: string | null; period_end: string | null; counts: DigestCounts | null
}

export type InactiveProspectMonths = 6 | 12 | 24 | 36
export type LinkedinPostsRetentionDays = 7 | 14 | 30 | 60 | 90
export type DataAccessAction =
  | 'export_companies' | 'export_waalaxy' | 'export_account'
  | 'api_key_saved' | 'api_key_deleted'
  | 'retention_changed' | 'retention_purge'
type DataRetentionSettings = {
  user_id: string; inactive_prospect_months: InactiveProspectMonths; auto_purge_enabled: boolean
  linkedin_posts_days: LinkedinPostsRetentionDays; last_purge_at: string | null; updated_at: string
}
type DataAccessLogEntry = {
  id: number; user_id: string; action: DataAccessAction; details: Record<string, string | number | boolean | null>
  created_at: string
}

export type Database = MergeDeep<
  GeneratedDatabase,
  {
    public: {
      Tables: {
        sophie_preferences: Columns<{
          user_id: string; frequency: SophieFrequency; alerts_since: string | null
          alerts_through: string | null; digest_from: string | null
        }> & { Relationships: [] }
        sophie_notifications: Columns<SophieNotification> & { Relationships: [] }
        data_retention_settings: Columns<DataRetentionSettings> & { Relationships: [] }
        data_access_log: Columns<DataAccessLogEntry> & { Relationships: [] }
        reminders: Columns<{ priority: ReminderPriority | null }>
        pipeline_stages: Columns<{ kind: PipelineStageKind; role: PipelineStageRole | null }>
        companies: Columns<{
          website_audit_url: string | null
          website_audited_at: string | null
          origin: CompanyOrigin
          kind: CompanyKind
          size_category: SizeCategory | null
          segment: CompanySegment | null
          segment_set_by: CompanySegmentSetBy
        }>
        company_contacts: Columns<{ email_source: EmailSource | null }>
        company_interactions: Columns<{
          type: CompanyInteractionType
          direction: InteractionDirection | null
          status: CompanyInteractionStatus
        }>
        pipeline_runs: Columns<{ triggered_by: PipelineRunTrigger; status: PipelineRunStatus }>
        linkedin_sequences: Columns<{ status: LinkedinSequenceStatus }>
        linkedin_posts: Columns<{ status: LinkedinPostStatus }>
      }
      Functions: {
        set_sophie_preferences: { Args: { p_frequency: SophieFrequency; p_digest: boolean }; Returns: undefined }
        preview_my_retention: { Args: { p_months: number }; Returns: { companies: number; contacts: number }[] }
        purge_my_inactive_prospects: { Args: Record<string, never>; Returns: number }
        log_my_data_access: {
          Args: { p_action: 'export_companies' | 'export_waalaxy' | 'export_account'; p_details?: Record<string, number | boolean | string> }
          Returns: undefined
        }
      }
      Views: {
        contact_outreach: { Row: { status: OutreachStatus | null } }
      }
    }
  }
>
