import { createClient } from '@/lib/supabase/server'
import type {
  CompanyContact,
  CompanyQualification,
  CompanyInteractionWithContact,
  CompanySignalWithType,
  CompanyWithRelations,
  LeadSource,
  PipelineStage,
} from '@/types'
import { getAuthUser } from '@/lib/supabase/auth'

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

  const user = await getAuthUser()

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

  const user = await getAuthUser()

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

  const user = await getAuthUser()

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

  const user = await getAuthUser()

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

/**
 * Dernier calcul de score de l'entreprise, avec ses raisons
 */
export async function getLatestQualification(companyId: string): Promise<CompanyQualification | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('company_qualifications')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

/**
 * Nombre d'entreprises par étape et par source (pour prévenir avant une suppression)
 */
export async function getPipelineUsage(): Promise<{
  byStage: Record<string, number>
  bySource: Record<string, number>
}> {
  const supabase = await createClient()

  const user = await getAuthUser()

  const usage = { byStage: {} as Record<string, number>, bySource: {} as Record<string, number> }
  if (!user) return usage

  const { data } = await supabase.from('companies').select('stage_id, source_id').eq('user_id', user.id)

  for (const company of data ?? []) {
    if (company.stage_id) usage.byStage[company.stage_id] = (usage.byStage[company.stage_id] ?? 0) + 1
    if (company.source_id) usage.bySource[company.source_id] = (usage.bySource[company.source_id] ?? 0) + 1
  }
  return usage
}
