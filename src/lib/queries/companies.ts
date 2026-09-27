import { createClient } from '@/lib/supabase/server'
import type {
  CompanyContact,
  CompanyInteractionWithContact,
  CompanySignalWithType,
  CompanyWithRelations,
  LeadSource,
  PipelineStage,
} from '@/types'

const COMPANY_RELATIONS = `
  *,
  stage:pipeline_stages(id, name, color, kind, order),
  source:lead_sources(id, name, icon)
`

/**
 * Entreprises de l'utilisateur, les mieux notées puis les plus récentes en premier.
 * Le filtrage (recherche, étape, source) se fait côté client sur cette liste.
 */
export async function getCompanies(limit = 200): Promise<CompanyWithRelations[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('companies')
    .select(COMPANY_RELATIONS)
    .eq('user_id', user.id)
    .order('score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return []
  }

  return data
}

export async function getCompanyById(companyId: string): Promise<CompanyWithRelations | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('companies')
    .select(COMPANY_RELATIONS)
    .eq('id', companyId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Personnes à contacter : décideurs d'abord
 */
export async function getCompanyContacts(companyId: string): Promise<CompanyContact[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_contacts')
    .select('*')
    .eq('company_id', companyId)
    .order('is_decision_maker', { ascending: false })
    .order('created_at', { ascending: true })

  if (error || !data) {
    return []
  }

  return data
}

/**
 * Signaux d'achat encore valides (non expirés), les plus récents d'abord
 */
export async function getCompanySignals(companyId: string): Promise<CompanySignalWithType[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_signals')
    .select('*, type:signal_types(label, description)')
    .eq('company_id', companyId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('detected_at', { ascending: false })

  if (error || !data) {
    return []
  }

  return data
}

export async function getCompanyInteractions(
  companyId: string,
  limit = 100
): Promise<CompanyInteractionWithContact[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_interactions')
    .select('*, contact:company_contacts(id, first_name, last_name)')
    .eq('company_id', companyId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return []
  }

  return data
}

/**
 * Étapes du pipeline, dans l'ordre d'affichage
 */
export async function getPipelineStages(): Promise<PipelineStage[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('user_id', user.id)
    .order('order', { ascending: true })

  if (error || !data) {
    return []
  }

  return data
}

export async function getLeadSources(): Promise<LeadSource[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('lead_sources')
    .select('*')
    .eq('user_id', user.id)
    .order('order', { ascending: true })

  if (error || !data) {
    return []
  }

  return data
}
