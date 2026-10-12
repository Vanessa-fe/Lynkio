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

export type Database = MergeDeep<
  GeneratedDatabase,
  {
    public: {
      Tables: {
        reminders: Columns<{ priority: ReminderPriority | null }>
        pipeline_stages: Columns<{ kind: PipelineStageKind; role: PipelineStageRole | null }>
        companies: Columns<{
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
      }
      Views: {
        contact_outreach: { Row: { status: OutreachStatus | null } }
      }
    }
  }
>
