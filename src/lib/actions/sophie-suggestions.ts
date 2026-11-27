'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { captureServerEvent } from '@/lib/posthog-server'
import { buildSophieWelcome, NO_REPLY_DAYS, type SophieWelcome, type SuggestionFacts } from '@/lib/sophie-suggestions'

/**
 * Suggestions proactives de Sophie (phase 5) : lecture des données réelles, règles sans IA
 * (src/lib/sophie-suggestions.ts), « Ignorer » mémorisé, mesure d'utilité (vue / suivie / écartée).
 */

const DAY_MS = 24 * 60 * 60 * 1000
// Au-delà, un envoi sans réponse n'est plus une relance utile à proposer
const NO_REPLY_WINDOW_DAYS = 45
const SENT_TYPES = ['email', 'linkedin_message', 'whatsapp']

/** Fin de la journée en cours, heure de Paris */
function endOfParisDay(now: Date): Date {
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(now)
  const guess = new Date(`${day}T23:59:59Z`)
  const parisHour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(guess)
  )
  return new Date(guess.getTime() - ((parisHour - 23 + 24) % 24) * 60 * 60 * 1000)
}

/** null : suggestions désactivées dans les réglages */
export async function loadSophieSuggestions(surface: 'panel' = 'panel'): Promise<SophieWelcome | null> {
  const user = await getAuthUser()
  if (!user) return null
  const supabase = await createClient()
  const now = new Date()

  const { data: profile } = await supabase.from('user_profiles').select('sophie_suggestions').eq('id', user.id).maybeSingle()
  if (profile && profile.sophie_suggestions === false) return null

  const [{ data: stages }, { data: reminders }, { data: dismissedRows }, { data: engaged }, { data: discoveries }] =
    await Promise.all([
      supabase.from('pipeline_stages').select('id, kind').eq('user_id', user.id),
      supabase
        .from('reminders')
        .select('id, title, due_at, company_id, companies(name)')
        .eq('user_id', user.id)
        .is('completed_at', null)
        .lte('due_at', endOfParisDay(now).toISOString())
        .order('due_at', { ascending: true })
        .limit(10),
      supabase.from('sophie_suggestion_states').select('key, until').eq('user_id', user.id),
      supabase
        .from('companies')
        .select('id, name, stage_id')
        .eq('user_id', user.id)
        .not('engaged_at', 'is', null)
        .limit(1000),
      supabase
        .from('companies')
        .select('id, name, score, stage_id, created_at')
        .eq('user_id', user.id)
        .is('engaged_at', null)
        .gte('created_at', new Date(now.getTime() - 7 * DAY_MS).toISOString())
        .order('score', { ascending: false, nullsFirst: false })
        .limit(200),
    ])

  const kindOf = new Map((stages ?? []).map((stage) => [stage.id, stage.kind]))
  // En démarche et en cours (ni signée, ni perdue, ni écartée)
  const active = (engaged ?? []).filter((company) => !company.stage_id || kindOf.get(company.stage_id) === 'open')
  const activeIds = active.map((company) => company.id)
  const nameOf = new Map(active.map((company) => [company.id, company.name]))

  let unanswered: SuggestionFacts['unanswered'] = []
  let uncontactedDecisionMakers: SuggestionFacts['uncontactedDecisionMakers'] = []
  if (activeIds.length > 0) {
    const [{ data: interactions }, { data: openReminders }, { data: contacts }] = await Promise.all([
      supabase
        .from('company_interactions')
        .select('id, company_id, type, direction, occurred_at')
        .eq('user_id', user.id)
        .eq('status', 'done')
        .in('company_id', activeIds)
        .order('occurred_at', { ascending: false })
        .limit(3000),
      supabase.from('reminders').select('company_id').eq('user_id', user.id).is('completed_at', null).not('company_id', 'is', null),
      supabase
        .from('company_contacts')
        .select('id, company_id, first_name, last_name, role')
        .eq('user_id', user.id)
        .eq('is_decision_maker', true)
        .is('opted_out_at', null)
        .in('company_id', activeIds)
        .limit(500),
    ])

    const withReminder = new Set((openReminders ?? []).map((reminder) => reminder.company_id))
    const latest = new Map<string, NonNullable<typeof interactions>[number]>()
    const contacted = new Set<string>()
    for (const interaction of interactions ?? []) {
      if (!latest.has(interaction.company_id)) latest.set(interaction.company_id, interaction)
      if (interaction.direction === 'outgoing') contacted.add(interaction.company_id)
    }

    const windowStart = now.getTime() - NO_REPLY_WINDOW_DAYS * DAY_MS
    const threshold = now.getTime() - NO_REPLY_DAYS * DAY_MS
    unanswered = [...latest.values()]
      .filter(
        (interaction) =>
          interaction.direction === 'outgoing' &&
          SENT_TYPES.includes(interaction.type) &&
          !withReminder.has(interaction.company_id) &&
          new Date(interaction.occurred_at).getTime() <= threshold &&
          new Date(interaction.occurred_at).getTime() >= windowStart
      )
      // Les plus anciennes d'abord : elles risquent le plus d'être oubliées
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
      .map((interaction) => ({
        interactionId: interaction.id,
        companyId: interaction.company_id,
        companyName: nameOf.get(interaction.company_id) ?? 'cette entreprise',
        type: interaction.type,
        occurredAt: interaction.occurred_at,
      }))

    uncontactedDecisionMakers = (contacts ?? [])
      .filter((contact) => !contacted.has(contact.company_id))
      .map((contact) => ({
        contactId: contact.id,
        companyId: contact.company_id,
        companyName: nameOf.get(contact.company_id) ?? 'cette entreprise',
        name: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'le dirigeant',
        role: contact.role,
      }))
  }

  const dismissed = new Set(
    (dismissedRows ?? []).filter((row) => !row.until || new Date(row.until) > now).map((row) => row.key)
  )

  const welcome = buildSophieWelcome(
    {
      dueReminders: (reminders ?? []).map((reminder) => ({
        id: reminder.id,
        title: reminder.title,
        dueAt: reminder.due_at,
        companyId: reminder.company_id,
        companyName: (reminder.companies as { name: string } | null)?.name ?? null,
      })),
      unanswered,
      uncontactedDecisionMakers,
      newDiscoveries: (discoveries ?? [])
        .filter((company) => !company.stage_id || kindOf.get(company.stage_id) !== 'excluded')
        .map((company) => ({ id: company.id, name: company.name, score: company.score, createdAt: company.created_at })),
    },
    { now, dismissed }
  )

  if (welcome.suggestions.length > 0) {
    captureServerEvent(user.id, 'sophie_suggestions_shown', {
      surface,
      count: welcome.suggestions.length,
      kinds: welcome.suggestions.map((suggestion) => suggestion.kind),
    })
  }
  return welcome
}

const keySchema = z.string().min(1).max(120).regex(/^(reminder|no-reply|decision-maker|discoveries):[0-9A-Za-z:.\-T]+$/)

/** « Ignorer » : la suggestion ne revient plus (un nouveau cas en donnera une nouvelle) */
export async function dismissSophieSuggestion(key: string): Promise<{ success: boolean }> {
  if (!keySchema.safeParse(key).success) return { success: false }
  const user = await getAuthUser()
  if (!user) return { success: false }
  const supabase = await createClient()
  const { error } = await supabase
    .from('sophie_suggestion_states')
    .upsert({ user_id: user.id, key, status: 'dismissed', until: null }, { onConflict: 'user_id,key' })
  if (error) return { success: false }
  captureServerEvent(user.id, 'sophie_suggestion_dismissed', { kind: key.split(':')[0] })
  return { success: true }
}

/** Mesure d'utilité : suggestion suivie (clic) */
export async function trackSophieSuggestionFollowed(key: string): Promise<void> {
  if (!keySchema.safeParse(key).success) return
  const user = await getAuthUser()
  if (!user) return
  captureServerEvent(user.id, 'sophie_suggestion_followed', { kind: key.split(':')[0] })
}
