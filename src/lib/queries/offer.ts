import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { parisMidnight } from '@/lib/billing'
import { readOffer, type Offer } from '@/lib/validations/offer'

/** « Mon offre et mes objectifs » du client idéal actif (null : pas encore de client idéal) */
export async function getOffer(): Promise<Offer | null> {
  const user = await getAuthUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('icp_profiles')
    .select('criteria')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  return data ? readOffer(data.criteria) : null
}

export type GoalProgress = {
  goals: Offer['goals']
  // Prises de contact faites depuis lundi (e-mail, message LinkedIn, appel envoyés)
  contactsThisWeek: number
  // Fiches passées à une étape « gagnée » depuis le 1er du mois
  clientsThisMonth: number
  // Montant estimé des fiches gagnées ce mois-ci (quand il est renseigné)
  revenueThisMonth: number
}

/** Lundi 0 h, heure de Paris, de la semaine en cours */
function parisWeekStart(now: Date): Date {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short' }).format(now)
  const offset = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday)
  return parisMidnight(now, -Math.max(offset, 0))
}

/** 1er du mois 0 h, heure de Paris */
function parisMonthStart(now: Date): Date {
  const day = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', day: 'numeric' }).format(now))
  return parisMidnight(now, -(day - 1))
}

/** Baromètre du tableau de bord : où l'on en est par rapport à ses objectifs, d'après ses vraies données */
export async function getGoalProgress(): Promise<GoalProgress | null> {
  const user = await getAuthUser()
  if (!user) return null
  const offer = await getOffer()
  if (!offer) return null

  const supabase = await createClient()
  const now = new Date()
  const [contacts, won] = await Promise.all([
    supabase
      .from('company_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'done')
      .eq('direction', 'outgoing')
      .in('type', ['email', 'linkedin_message', 'call'])
      .gte('occurred_at', parisWeekStart(now).toISOString()),
    supabase
      .from('company_stage_events')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('to_stage_kind', 'won')
      .gte('changed_at', parisMonthStart(now).toISOString()),
  ])

  const wonIds = [...new Set((won.data ?? []).map((row) => row.company_id))]
  let revenue = 0
  if (wonIds.length > 0) {
    const { data } = await supabase.from('companies').select('estimated_amount').in('id', wonIds).eq('user_id', user.id)
    revenue = (data ?? []).reduce((total, row) => total + Number(row.estimated_amount ?? 0), 0)
  }

  return {
    goals: offer.goals,
    contactsThisWeek: contacts.count ?? 0,
    clientsThisMonth: wonIds.length,
    revenueThisMonth: revenue,
  }
}
