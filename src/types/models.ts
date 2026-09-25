import type { Database } from './database'

/**
 * Types métier dérivés des types de base de données
 */

// Alias pour les types de tables
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type ContactStatus = Database['public']['Tables']['contact_statuses']['Row']
export type ContactSource = Database['public']['Tables']['contact_sources']['Row']
export type Contact = Database['public']['Tables']['contacts']['Row']
export type ContactChannel = Database['public']['Tables']['contact_channels']['Row']
export type Interaction = Database['public']['Tables']['interactions']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type Reminder = Database['public']['Tables']['reminders']['Row']
export type AgencyStatus = Database['public']['Tables']['agency_statuses']['Row']
export type AgencySource = Database['public']['Tables']['agency_sources']['Row']
export type Agency = Database['public']['Tables']['agencies']['Row']
export type AgencyInteraction = Database['public']['Tables']['agency_interactions']['Row']

// Types d'insertion
export type InsertUserProfile = Database['public']['Tables']['user_profiles']['Insert']
export type InsertContactStatus = Database['public']['Tables']['contact_statuses']['Insert']
export type InsertContactSource = Database['public']['Tables']['contact_sources']['Insert']
export type InsertContact = Database['public']['Tables']['contacts']['Insert']
export type InsertContactChannel = Database['public']['Tables']['contact_channels']['Insert']
export type InsertInteraction = Database['public']['Tables']['interactions']['Insert']
export type InsertAppointment = Database['public']['Tables']['appointments']['Insert']
export type InsertPayment = Database['public']['Tables']['payments']['Insert']
export type InsertReminder = Database['public']['Tables']['reminders']['Insert']
export type InsertAgencyStatus = Database['public']['Tables']['agency_statuses']['Insert']
export type InsertAgencySource = Database['public']['Tables']['agency_sources']['Insert']
export type InsertAgency = Database['public']['Tables']['agencies']['Insert']
export type InsertAgencyInteraction = Database['public']['Tables']['agency_interactions']['Insert']

// Types de mise à jour
export type UpdateUserProfile = Database['public']['Tables']['user_profiles']['Update']
export type UpdateContactStatus = Database['public']['Tables']['contact_statuses']['Update']
export type UpdateContactSource = Database['public']['Tables']['contact_sources']['Update']
export type UpdateContact = Database['public']['Tables']['contacts']['Update']
export type UpdateContactChannel = Database['public']['Tables']['contact_channels']['Update']
export type UpdateInteraction = Database['public']['Tables']['interactions']['Update']
export type UpdateAppointment = Database['public']['Tables']['appointments']['Update']
export type UpdatePayment = Database['public']['Tables']['payments']['Update']
export type UpdateReminder = Database['public']['Tables']['reminders']['Update']
export type UpdateAgencyStatus = Database['public']['Tables']['agency_statuses']['Update']
export type UpdateAgencySource = Database['public']['Tables']['agency_sources']['Update']
export type UpdateAgency = Database['public']['Tables']['agencies']['Update']
export type UpdateAgencyInteraction = Database['public']['Tables']['agency_interactions']['Update']

// Types énumérés
// Les types générés par Supabase ne connaissent pas les contraintes CHECK
// (ces colonnes y sont de simples `string | null`) : les valeurs possibles
// sont donc déclarées ici.
export type RiskLevel = 'normal' | 'monitor' | 'insistent' | 'blocked'
export type ChannelType =
  | 'whatsapp'
  | 'sms'
  | 'telegram'
  | 'signal'
  | 'phone'
  | 'instagram'
  | 'email'
  | 'website'
  | 'other'
export type InteractionType =
  | 'message'
  | 'call_incoming'
  | 'call_outgoing'
  | 'call_missed'
  | 'note'
  | 'reminder'
  | 'system_event'
export type InteractionDirection = 'incoming' | 'outgoing'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'check' | 'paypal' | 'other'
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded'
export type ReminderPriority = 'low' | 'medium' | 'high'
export type SizeRange = '1-5' | '6-15' | '16-50' | '50+'
export type SignalType = 'job_posting_dev' | 'nextjs_portfolio' | 'ai_offer' | 'other'
export type PreferredChannel = 'email' | 'linkedin' | 'phone' | 'other'
export type AgencyInteractionType = InteractionType
export type AgencyInteractionDirection = InteractionDirection

// Types composés pour les vues avec relations
export type ContactWithRelations = Contact & {
  status?: ContactStatus | null
  source?: ContactSource | null
  channels?: ContactChannel[]
}

export type InteractionWithContact = Interaction & {
  contact: Contact
}

export type AppointmentWithContact = Appointment & {
  contact: Contact
}

export type PaymentWithRelations = Payment & {
  contact: Contact
  appointment?: Appointment | null
}

export type ReminderWithRelations = Reminder & {
  contact?: Contact | null
  agency?: Agency | null
}

export type AgencyWithRelations = Agency & {
  status?: AgencyStatus | null
  source?: AgencySource | null
}

export type AgencyInteractionWithAgency = AgencyInteraction & {
  agency: Agency
}

// Types pour les formulaires
export type ContactFormData = Omit<InsertContact, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_interaction_at'>
export type AppointmentFormData = Omit<InsertAppointment, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type PaymentFormData = Omit<InsertPayment, 'id' | 'user_id' | 'created_at'>
export type ReminderFormData = Omit<InsertReminder, 'id' | 'user_id' | 'created_at'>
export type InteractionFormData = Omit<InsertInteraction, 'id' | 'user_id' | 'created_at'>
export type AgencyFormData = Omit<InsertAgency, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_interaction_at'>
export type AgencyInteractionFormData = Omit<InsertAgencyInteraction, 'id' | 'user_id' | 'created_at'>

// Types pour les statistiques du dashboard
export type DashboardStats = {
  totalContacts: number
  newContactsThisMonth: number
  appointmentsToday: number
  overdueReminders: number
  revenueThisMonth: number
}

export type ContactsByStatus = {
  statusName: string
  statusColor: string
  count: number
}

export type ContactsBySource = {
  sourceName: string
  count: number
}

// Types pour l'import/export
export type CSVContact = {
  first_name?: string
  last_name?: string
  nickname?: string
  phone?: string
  email?: string
  age?: string
  city?: string
  source?: string
  status?: string
  notes?: string
}

export type ImportPreview = {
  validRows: CSVContact[]
  invalidRows: Array<{ row: CSVContact; errors: string[] }>
  duplicates: Array<{ row: CSVContact; existingContact: Contact }>
}
