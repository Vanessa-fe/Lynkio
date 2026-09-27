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
  AppointmentStatus,
  ChannelType,
  CompanyInteractionStatus,
  CompanyInteractionType,
  CompanyOrigin,
  EmailSource,
  InteractionDirection,
  InteractionType,
  PaymentMethod,
  PaymentStatus,
  PipelineRunStatus,
  PipelineRunTrigger,
  PipelineStageKind,
  PreferredChannel,
  ReminderPriority,
  RiskLevel,
  SignalType,
  SizeCategory,
  SizeRange,
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
        contacts: Columns<{ risk_level: RiskLevel | null }>
        contact_channels: Columns<{ channel_type: ChannelType }>
        interactions: Columns<{ type: InteractionType; direction: InteractionDirection | null }>
        appointments: Columns<{ status: AppointmentStatus | null }>
        payments: Columns<{
          payment_method: PaymentMethod | null
          payment_status: PaymentStatus | null
        }>
        reminders: Columns<{ priority: ReminderPriority | null }>
        agencies: Columns<{
          size_range: SizeRange | null
          signal_type: SignalType | null
          preferred_channel: PreferredChannel | null
        }>
        agency_interactions: Columns<{
          type: InteractionType
          direction: InteractionDirection | null
        }>
        pipeline_stages: Columns<{ kind: PipelineStageKind }>
        companies: Columns<{ origin: CompanyOrigin; size_category: SizeCategory | null }>
        company_contacts: Columns<{ email_source: EmailSource | null }>
        company_interactions: Columns<{
          type: CompanyInteractionType
          direction: InteractionDirection | null
          status: CompanyInteractionStatus
        }>
        pipeline_runs: Columns<{ triggered_by: PipelineRunTrigger; status: PipelineRunStatus }>
      }
    }
  }
>
