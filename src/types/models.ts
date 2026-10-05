import type { Database } from './database'

/**
 * Types métier dérivés des types de base de données
 */

// Alias pour les types de tables
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type Reminder = Database['public']['Tables']['reminders']['Row']
export type Profession = Database['public']['Tables']['professions']['Row']
export type IcpProfile = Database['public']['Tables']['icp_profiles']['Row']
export type PipelineStage = Database['public']['Tables']['pipeline_stages']['Row']
export type LeadSource = Database['public']['Tables']['lead_sources']['Row']
export type Company = Database['public']['Tables']['companies']['Row']
export type CompanyContact = Database['public']['Tables']['company_contacts']['Row']
export type CompanySignal = Database['public']['Tables']['company_signals']['Row']
export type CompanyInteraction = Database['public']['Tables']['company_interactions']['Row']
export type ProspectionSettings = Database['public']['Tables']['prospection_settings']['Row']
export type PipelineRun = Database['public']['Tables']['pipeline_runs']['Row']
export type UnidentifiedJobOffer = Database['public']['Tables']['unidentified_job_offers']['Row']
export type CompanyQualification = Database['public']['Tables']['company_qualifications']['Row']
export type ProspectList = Database['public']['Tables']['prospect_lists']['Row']
export type ContactOutreach = Database['public']['Views']['contact_outreach']['Row']

// Types d'insertion
export type InsertUserProfile = Database['public']['Tables']['user_profiles']['Insert']
export type InsertReminder = Database['public']['Tables']['reminders']['Insert']

// Types de mise à jour
export type UpdateUserProfile = Database['public']['Tables']['user_profiles']['Update']
export type UpdateReminder = Database['public']['Tables']['reminders']['Update']

// Types énumérés
// Les types générés par Supabase ne connaissent pas les contraintes CHECK
// (ces colonnes y sont de simples `string | null`) : les valeurs possibles
// sont donc déclarées ici.
export type InteractionDirection = 'incoming' | 'outgoing'
export type ReminderPriority = 'low' | 'medium' | 'high'
export type PipelineStageKind = 'open' | 'won' | 'lost' | 'excluded'
// Étapes vers lesquelles une fiche avance toute seule quand on note un envoi ou une réponse
export type PipelineStageRole = 'to_contact' | 'contacted' | 'followed_up' | 'in_discussion'
// Statut de prospection d'une personne, déduit de ses échanges (vue contact_outreach)
export type OutreachStatus = 'to_contact' | 'contacted' | 'followed_up' | 'replied' | 'do_not_contact'
export type CompanyOrigin = 'manual' | 'import' | 'detector'
// organization : entreprise ; individual : personne seule (indépendant ou entreprise inconnue)
export type CompanyKind = 'organization' | 'individual'
export type SizeCategory = 'solo' | 'tpe' | 'pme' | 'eti' | 'ge'
export type EmailSource = 'manual' | 'hunter' | 'website' | 'other'
export type CompanyInteractionType =
  | 'email'
  | 'linkedin_message'
  | 'call'
  | 'meeting'
  | 'note'
  | 'system_event'
export type CompanyInteractionStatus = 'draft' | 'scheduled' | 'done'
export type PipelineRunTrigger = 'manual' | 'schedule'
export type PipelineRunStatus = 'running' | 'succeeded' | 'failed'

// Types composés pour les vues avec relations
export type ReminderWithRelations = Reminder & {
  company?: Pick<Company, 'id' | 'name'> | null
}

export type CompanyWithRelations = Company & {
  stage?: Pick<PipelineStage, 'id' | 'name' | 'color' | 'kind' | 'order'> | null
  source?: Pick<LeadSource, 'id' | 'name' | 'icon'> | null
}

export type CompanySignalWithType = CompanySignal & {
  type: { label: string; description: string | null } | null
}

export type CompanyInteractionWithContact = CompanyInteraction & {
  contact: Pick<CompanyContact, 'id' | 'first_name' | 'last_name'> | null
}
