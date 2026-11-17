// Contexte de page donné à Sophie (lot 2.5 de la refonte) : seulement ce qui est utile à la page ouverte,
// lu avec le jeton de l'utilisateur (RLS : jamais les données d'un autre compte), au moment de la
// question (jamais une copie ancienne). Rien de ce contexte n'est enregistré avec le message.
//
// Le contexte est rendu en texte simple, placé par prompt.ts entre balises de données : ce sont des
// faits à lire, jamais des consignes à suivre.

import type { SupabaseClient } from '@supabase/supabase-js'
import { describeStage, type MeaningStage } from '../../../src/lib/stage-meaning.ts'

export type PageContext = { page: string; entityType: 'company' | null; entityId: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Pages connues (adresse sans paramètres) : le reste est ramené à « autre page »
const PAGE_LABELS: [RegExp, string][] = [
  [/^\/dashboard$/, 'tableau de bord'],
  [/^\/prospection(\/.*)?$/, 'Prospection (recherches d’entreprises)'],
  [/^\/companies\/[0-9a-f-]{36}(\/.*)?$/, 'fiche d’une entreprise'],
  [/^\/companies(\/new)?$/, 'liste des entreprises'],
  [/^\/people(\/.*)?$/, 'Contacts'],
  [/^\/lists$/, 'Listes de contacts'],
  [/^\/reminders$/, 'Suivi (relances)'],
  [/^\/settings(\/.*)?$/, 'Paramètres'],
]

/** Contexte reçu du navigateur, vérifié : une adresse connue et, au plus, l'identifiant d'une entreprise */
export function readPageContext(raw: unknown): PageContext {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const page = typeof input.page === 'string' && /^\/[a-z0-9/_-]{0,120}$/i.test(input.page) ? input.page : '/'
  const entityId = typeof input.entityId === 'string' && UUID.test(input.entityId) ? input.entityId : null
  const entityType = input.entityType === 'company' && entityId ? 'company' : null
  return { page, entityType, entityId: entityType ? entityId : null }
}

export function pageLabel(page: string): string {
  return PAGE_LABELS.find(([pattern]) => pattern.test(page))?.[1] ?? 'autre page'
}

const SIZE_LABELS: Record<string, string> = {
  solo: 'indépendant, sans salarié',
  tpe: 'TPE (1 à 9 salariés)',
  pme: 'PME (10 à 249 salariés)',
  eti: 'ETI (250 à 4 999 salariés)',
  ge: 'grande entreprise',
}

const DISCOVERY_LABELS: Record<string, string> = {
  registry: 'source officielle : registre des entreprises',
  bodacc: 'source officielle : créations récentes (BODACC)',
  job_postings: 'source officielle : offre d’emploi',
  tech_ai: 'analyse IA : recherche par technologie',
}

const NATURE_LABELS: Record<string, string> = {
  observed: 'fait constaté',
  hypothesis: 'hypothèse',
  explicit_need: 'besoin exprimé',
}

const day = (value: string | null | undefined) => (value ? value.slice(0, 10) : 'inconnue')

/**
 * Faits utiles pour la page ouverte. Une erreur de lecture n'empêche pas de répondre : Sophie dit
 * alors qu'elle n'a pas pu lire ces informations.
 */
export async function loadPageFacts(supabase: SupabaseClient, userId: string, context: PageContext): Promise<string> {
  try {
    if (context.entityType === 'company' && context.entityId) return await companyFacts(supabase, context.entityId)
    if (/^\/dashboard$/.test(context.page)) return await dashboardFacts(supabase, userId)
    if (/^\/prospection/.test(context.page)) return await prospectionFacts(supabase, userId)
    if (/^\/companies$/.test(context.page)) return await companiesFacts(supabase, userId)
    return ''
  } catch (error) {
    console.error('sophie-chat context', error)
    return 'Les informations de cette page n’ont pas pu être lues pour cette réponse.'
  }
}

export async function companyFacts(supabase: SupabaseClient, companyId: string): Promise<string> {
  const [{ data: company }, { data: stages }, { data: signals }, { data: qualification }, { data: contacts }, { data: exchanges }, { data: reminders }, { data: followUps }] =
    await Promise.all([
      supabase
        .from('companies')
        .select(
          'id, name, kind, sector, city, postal_code, size_category, founded_on, score, engaged_at, next_action, estimated_amount, last_interaction_at, discovered_by, origin, stage_id, revenue, finances_year'
        )
        .eq('id', companyId)
        .maybeSingle(),
      supabase.from('pipeline_stages').select('id, name, kind, role, order, is_default'),
      supabase
        .from('company_signals')
        .select('detected_at, event_at, invalidated_at, type:signal_types(label, nature)')
        .eq('company_id', companyId)
        .is('invalidated_at', null)
        .order('detected_at', { ascending: false })
        .limit(8),
      supabase
        .from('company_qualifications')
        .select('score, is_eliminated, elimination_reason, reasons')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('company_contacts').select('role, is_decision_maker, opted_out_at').eq('company_id', companyId).limit(20),
      supabase
        .from('company_interactions')
        .select('type, direction, status, occurred_at')
        .eq('company_id', companyId)
        .neq('type', 'system_event')
        .order('occurred_at', { ascending: false })
        .limit(6),
      supabase
        .from('reminders')
        .select('title, due_at')
        .eq('company_id', companyId)
        .is('completed_at', null)
        .order('due_at')
        .limit(3),
      supabase.from('exchange_follow_ups').select('follow_up_number').eq('company_id', companyId).gt('follow_up_number', 0),
    ])

  if (!company) return 'Cette entreprise est introuvable (supprimée, ou pas dans ce compte).'

  const stage = (stages ?? []).find((candidate) => candidate.id === company.stage_id) as MeaningStage | undefined
  const lines = [
    `Entreprise ouverte : ${company.name}${company.kind === 'individual' ? ' (personne seule)' : ''}`,
    `Activité : ${company.sector ?? 'inconnue'} · Ville : ${company.city ?? 'inconnue'}${company.postal_code ? ` (${company.postal_code})` : ''}`,
    `Taille : ${company.size_category ? (SIZE_LABELS[company.size_category] ?? company.size_category) : 'inconnue'} · Création : ${day(company.founded_on)}`,
    company.revenue && company.finances_year ? `Chiffre d’affaires publié : ${company.revenue} € (comptes ${company.finances_year})` : 'Chiffre d’affaires : non publié',
    `Provenance : ${company.discovered_by ? DISCOVERY_LABELS[company.discovered_by] : company.origin === 'manual' ? 'ajoutée à la main' : company.origin === 'import' ? 'import CSV' : 'non enregistrée'}`,
    `Suivi commercial : ${company.engaged_at ? `en démarche depuis le ${day(company.engaged_at)}` : 'découverte, pas encore en démarche'}`,
    `Étape : ${stage ? describeStage(stage, (stages ?? []) as MeaningStage[]).summary : 'sans étape'}`,
    `Prochaine action : ${company.next_action ?? 'à définir'} · Montant estimé : ${company.estimated_amount != null ? `${company.estimated_amount} € HT` : 'non estimé'}`,
    `Dernier échange : ${company.last_interaction_at ? day(company.last_interaction_at) : 'jamais contactée'} · Relances envoyées : ${followUps?.length ?? 0}`,
  ]

  if (qualification) {
    const reasons = Array.isArray(qualification.reasons)
      ? (qualification.reasons as { label?: string; points?: number }[])
          .filter((reason) => typeof reason.label === 'string')
          .map((reason) => `${reason.label} (${reason.points ?? 0} pts)`)
          .slice(0, 12)
      : []
    lines.push(
      qualification.is_eliminated
        ? `Score de compatibilité : écartée (${qualification.elimination_reason ?? 'raison non précisée'})`
        : `Score de compatibilité : ${qualification.score}/100 (compatibilité avec les critères du client idéal, PAS une probabilité de signer). Détail : ${reasons.join(' ; ') || 'aucun critère ne rapporte de points'}`
    )
  } else {
    lines.push(`Score de compatibilité : ${company.score ?? 'pas encore calculé'}/100`)
  }

  const signalLines = (signals ?? []).map((signal) => {
    const type = signal.type as { label?: string; nature?: string } | null
    return `- ${type?.label ?? 'signal'} (${NATURE_LABELS[type?.nature ?? 'observed'] ?? 'fait constaté'}, ${signal.event_at ? `événement du ${day(signal.event_at)}` : `relevé le ${day(signal.detected_at)}`})`
  })
  lines.push(signalLines.length > 0 ? `Signaux d’opportunité :\n${signalLines.join('\n')}` : 'Signaux d’opportunité : aucun observé')

  const activeContacts = (contacts ?? []).filter((contact) => !contact.opted_out_at)
  lines.push(
    `Contacts : ${activeContacts.length}${activeContacts.length > 0 ? ` (fonctions : ${activeContacts.map((contact) => `${contact.role ?? 'fonction inconnue'}${contact.is_decision_maker ? ', décideur' : ''}`).join(' ; ')})` : ''}${(contacts ?? []).length > activeContacts.length ? ' ; certains ne veulent plus être contactés' : ''}`
  )
  const exchangeLines = (exchanges ?? []).map(
    (exchange) => `- ${exchange.type}${exchange.direction ? ` ${exchange.direction === 'incoming' ? 'reçu' : 'envoyé'}` : ''}${exchange.status !== 'done' ? ` (${exchange.status})` : ''} le ${day(exchange.occurred_at)}`
  )
  lines.push(exchangeLines.length > 0 ? `Derniers échanges notés :\n${exchangeLines.join('\n')}` : 'Échanges notés : aucun')
  lines.push(
    (reminders ?? []).length > 0
      ? `Relances prévues : ${(reminders ?? []).map((reminder) => `${reminder.title} (${day(reminder.due_at)})`).join(' ; ')}`
      : 'Relances prévues : aucune'
  )
  return lines.join('\n')
}

async function dashboardFacts(supabase: SupabaseClient, userId: string): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const endOfToday = new Date()
  endOfToday.setUTCHours(23, 59, 59, 999)
  const [discovered, engaged, reminders, run] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('engaged_at', null).gte('created_at', weekAgo),
    supabase.from('companies').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('engaged_at', 'is', null),
    supabase.from('reminders').select('due_at').eq('user_id', userId).is('completed_at', null).lte('due_at', endOfToday.toISOString()).limit(50),
    supabase.from('pipeline_runs').select('status, started_at, companies_created, error').eq('user_id', userId).order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const now = Date.now()
  const due = reminders.data ?? []
  const overdue = due.filter((reminder) => new Date(reminder.due_at).getTime() < now - 12 * 3_600_000).length
  return [
    `Nouvelles découvertes cette semaine (pas encore en démarche) : ${discovered.count ?? 0}`,
    `Entreprises en démarche commerciale : ${engaged.count ?? 0}`,
    `Relances du jour ou en retard : ${due.length} (dont ${overdue} en retard)`,
    run.data
      ? `Dernière recherche : ${day(run.data.started_at)}, ${run.data.status === 'failed' ? `échouée (${run.data.error ?? 'erreur'})` : `${run.data.companies_created} entreprise(s) ajoutée(s)`}`
      : 'Aucune recherche lancée pour l’instant',
  ].join('\n')
}

async function prospectionFacts(supabase: SupabaseClient, userId: string): Promise<string> {
  const [{ data: strategies }, { data: run }] = await Promise.all([
    supabase.from('prospect_strategies').select('name').eq('user_id', userId).order('created_at').limit(10),
    supabase.from('pipeline_runs').select('status, started_at, companies_created').eq('user_id', userId).order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  return [
    (strategies ?? []).length > 0
      ? `Recherches enregistrées : ${(strategies ?? []).map((strategy) => `« ${strategy.name} »`).join(', ')}`
      : 'Aucune recherche enregistrée',
    run ? `Dernière recherche : ${day(run.started_at)} (${run.status}, ${run.companies_created} ajoutée(s))` : 'Aucune recherche lancée',
  ].join('\n')
}

async function companiesFacts(supabase: SupabaseClient, userId: string): Promise<string> {
  const [all, engaged] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('companies').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('engaged_at', 'is', null),
  ])
  return `Entreprises : ${all.count ?? 0} au total, dont ${engaged.count ?? 0} en démarche commerciale et ${(all.count ?? 0) - (engaged.count ?? 0)} découvertes ou écartées`
}
