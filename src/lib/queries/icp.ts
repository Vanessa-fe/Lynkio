import { createClient } from '@/lib/supabase/server'
import type { IcpProfile } from '@/types'
import { getAuthUser } from '@/lib/supabase/auth'

export type SignalWeightOption = {
  key: string
  label: string
  description: string | null
  // Poids par défaut du métier (0 si le signal ne sert pas à ce métier)
  defaultWeight: number
  // Signal utile pour le métier de l'utilisateur
  isProfessionSignal: boolean
}

/**
 * Client idéal actif de l'utilisateur, avec les signaux et leurs poids par défaut
 */
export async function getIcpSettings(): Promise<{
  icp: IcpProfile
  signals: SignalWeightOption[]
  companiesCount: number
} | null> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return null
  }

  const [{ data: icp }, { data: profile }, { data: signalTypes }, { count }] = await Promise.all([
    supabase
      .from('icp_profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
    supabase.from('user_profiles').select('profession_key').eq('id', user.id).maybeSingle(),
    supabase.from('signal_types').select('key, label, description').eq('is_active', true).order('label'),
    supabase.from('companies').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  if (!icp) {
    return null
  }

  const professionKey = icp.profession_key ?? profile?.profession_key ?? null
  const { data: professionSignals } = professionKey
    ? await supabase
        .from('profession_signals')
        .select('signal_type, default_weight')
        .eq('profession_key', professionKey)
    : { data: [] }

  const defaults = new Map((professionSignals ?? []).map((row) => [row.signal_type, row.default_weight]))

  const signals = (signalTypes ?? [])
    .map((type) => ({
      key: type.key,
      label: type.label,
      description: type.description,
      defaultWeight: defaults.get(type.key) ?? 0,
      isProfessionSignal: defaults.has(type.key),
    }))
    // Les signaux du métier d'abord, les plus importants en haut
    .sort((a, b) => Number(b.isProfessionSignal) - Number(a.isProfessionSignal) || b.defaultWeight - a.defaultWeight)

  return { icp, signals, companiesCount: count ?? 0 }
}

/**
 * Tarif journalier et technologies du client idéal actif (budget des entreprises,
 * recherche par technologie)
 */
export async function getIcpBasics(): Promise<{ dayRate: number | null; techStack: string[] }> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return { dayRate: null, techStack: [] }
  }

  const { data } = await supabase
    .from('icp_profiles')
    .select('criteria')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const criteria = (data?.criteria ?? {}) as { day_rate?: unknown; tech_stack?: unknown }
  return {
    dayRate: typeof criteria.day_rate === 'number' ? criteria.day_rate : null,
    techStack: Array.isArray(criteria.tech_stack)
      ? criteria.tech_stack.filter((tech): tech is string => typeof tech === 'string')
      : [],
  }
}
