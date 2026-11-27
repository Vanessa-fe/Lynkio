// Sophie prépare un premier message (e-mail, LinkedIn ou WhatsApp) pour une entreprise.
//
// POST, JSON : { companyId, channel: "email" | "linkedin_message" | "whatsapp", contactId?, instructions?, situation? }
// WhatsApp (offre Pro) : contactId obligatoire, et le contact doit avoir un numéro de téléphone.
// situation "after_invitation" : message LinkedIn envoyé juste après l'acceptation d'une invitation sans note.
// sequence true (LinkedIn) : Sophie écrit aussi les deux relances ; la réponse a alors followUp1 et followUp2.
// Réponse : { subject, body, angle, signal, warnings }. Rien n'est enregistré ici :
// l'application enregistre le brouillon si l'utilisatrice le garde.
//
// Appelée directement depuis le navigateur, pas par une action serveur : Netlify
// coupe une action au bout d'une dizaine de secondes, et la rédaction en prend
// souvent plus. La passerelle vérifie le jeton de l'utilisatrice (verify_jwt), et
// la fonction lit la base avec ce même jeton : les règles RLS s'appliquent, elle
// ne voit que ses données.

import { createClient } from '@supabase/supabase-js'
import { accountPlan, planDenial } from '../_shared/plan.ts'
import { loadAiAccess, recordAiUsage } from '../_shared/ai.ts'
import { TECHNOLOGY_LABELS } from '../_shared/technologies.ts'
import { checkDraft } from './checks.ts'
import { fetchSiteText } from './site-text.ts'
import { opportunityEvent, readSignalRecommendation } from '../_shared/signal-capabilities.ts'
import { UserFacingError, writeDraft, type Channel, type SignalForMessage, type Tone } from './writer.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_INSTRUCTIONS_LENGTH = 500
const MAX_SIGNALS = 5
const MAX_REFERENCES = 10
const MAX_JOB_AD_LENGTH = 3000

// Le site en production (filonea.fr, filonea.com, et l'adresse Netlify avec ses aperçus de déploiement),
// et le développement local
const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?filonea\.(fr|com)$/,
  /^https:\/\/([a-z0-9-]+--)?lynkio\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
]

const SIZE_LABELS: Record<string, string> = {
  solo: 'indépendant, sans salarié',
  tpe: 'TPE (1 à 9 salariés)',
  pme: 'PME (10 à 249 salariés)',
  eti: 'ETI (250 à 4 999 salariés)',
  ge: 'grande entreprise',
}

// Éléments d'un signal utiles au message (pas les identifiants techniques)
const EVIDENCE_LABELS: Record<string, string> = {
  intitule: 'intitulé',
  type_contrat: 'contrat',
  lieu: 'lieu',
  date_publication: 'publiée le',
  activite: 'activité',
  date_debut_activite: 'début d\'activité',
  technologies: 'technologies',
  // Analyse approfondie (company-deep-dive) : l'événement et ce qu'en dit la source vérifiée ;
  // « relevance » (hypothèse sur le besoin) n'est volontairement pas transmise comme un fait
  title: 'événement annoncé',
  summary: 'ce que dit la source',
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.some((allowed) => allowed.test(origin))) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function signalLead(
  evidence: Record<string, unknown>,
  advice: { why: string; service: string } | undefined
): { lead: string | null; service: string | null } {
  const lead = typeof evidence.relevance === 'string' && evidence.relevance.trim() ? evidence.relevance.trim() : advice?.why
  const service = typeof evidence.service === 'string' && evidence.service.trim() ? evidence.service.trim() : advice?.service
  return { lead: lead ? lead.slice(0, 300) : null, service: service ? service.slice(0, 80) : null }
}

function signalDetails(evidence: Record<string, unknown>): string[] {
  return Object.entries(EVIDENCE_LABELS).flatMap(([key, label]) => {
    const value = evidence[key]
    if (typeof value === 'string' && value.trim()) return [`${label} : ${value.trim().slice(0, 200)}`]
    if (Array.isArray(value) && value.length > 0) {
      const items = value.map((item) => TECHNOLOGY_LABELS[String(item)] ?? String(item))
      return [`${label} : ${items.join(', ')}`]
    }
    return []
  })
}

/**
 * RGPD (art. 14 et 21) : au premier e-mail, d'où vient l'adresse quand on le sait, et comment refuser
 * la suite (un lien quand le destinataire est un contact enregistré, sinon répondre « stop »).
 * Ajoutée par le code, jamais par l'IA, pour qu'elle soit toujours là et toujours exacte.
 */
function originNotice(emailSource: string | null, companyName: string, optOutUrl: string | null): string {
  const origin =
    emailSource === 'website'
      ? `J'ai trouvé votre adresse sur le site de ${companyName}. `
      : emailSource === 'hunter'
        ? 'J\'ai trouvé votre adresse professionnelle via l\'annuaire Hunter. '
        : emailSource === 'linkedin_post'
          ? 'J\'ai trouvé votre adresse dans une de vos publications LinkedIn. '
          : ''
  return optOutUrl
    ? `${origin}Pour ne plus recevoir de message de ma part : ${optOutUrl}`
    : `${origin}Si vous préférez ne plus recevoir de message de ma part, répondez simplement « stop ».`
}

/**
 * Crée un lien « ne plus être contacté » propre à ce contact (page publique /stop/<jeton>).
 * Seule l'empreinte du jeton est enregistrée. En cas d'échec, l'e-mail garde la phrase « stop ».
 */
async function createOptOutLink(
  admin: ReturnType<typeof createClient>,
  userId: string,
  contactId: string
): Promise<string | null> {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
  const { error } = await admin.from('opt_out_links').insert({ token_hash: hash, user_id: userId, contact_id: contactId })
  if (error) {
    console.error('opt-out link', error)
    return null
  }
  return `https://filonea.fr/stop/${token}`
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get('Origin'))
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  let input: {
    companyId?: unknown
    channel?: unknown
    contactId?: unknown
    instructions?: unknown
    situation?: unknown
    sequence?: unknown
    tone?: unknown
  }
  try {
    input = await request.json()
  } catch {
    return json({ error: 'Corps de requête invalide' }, 400)
  }

  const companyId = typeof input.companyId === 'string' && UUID.test(input.companyId) ? input.companyId : null
  const channel: Channel | null =
    input.channel === 'email' || input.channel === 'linkedin_message' || input.channel === 'whatsapp' ? input.channel : null
  const contactId = typeof input.contactId === 'string' && UUID.test(input.contactId) ? input.contactId : null
  // Ton choisi dans la fenêtre de rédaction (sobre par défaut)
  const tone: Tone = input.tone === 'warm' || input.tone === 'direct' ? input.tone : 'sober'
  const instructions =
    typeof input.instructions === 'string' ? input.instructions.trim().slice(0, MAX_INSTRUCTIONS_LENGTH) || null : null
  const afterInvitation = input.situation === 'after_invitation' && channel === 'linkedin_message'
  const sequence = input.sequence === true && channel === 'linkedin_message'

  if (!companyId || !channel) return json({ error: 'Entreprise ou canal invalide' }, 400)
  if (channel === 'whatsapp' && !contactId) return json({ error: 'Choisissez à qui écrire sur WhatsApp' }, 400)

  const authorization = request.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: auth } = await supabase.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  const user = auth?.user
  if (!user) return json({ error: 'Vous devez être connecté' }, 401)

  // Seul le rôle service_role peut déchiffrer la clé d'IA de l'utilisateur
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Messages LinkedIn, WhatsApp et relances : offre Pro ; premiers e-mails : toutes les offres
  const denial = planDenial(await accountPlan(admin, user.id), channel !== 'email')
  if (denial) return json({ error: denial.message, code: denial.code }, 403)

  try {
    const access = await loadAiAccess(admin, user.id, 'draft')
    const [company, signals, contact, profile, icp, references, lastOutgoing] = await Promise.all([
      supabase
        .from('companies')
        .select('name, kind, segment, sector, city, size_category, website, detected_stack, strategy_id')
        .eq('id', companyId)
        .maybeSingle(),
      supabase
        .from('company_signals')
        .select('id, signal_type, evidence, detected_at, expires_at, source, source_url, event_at, type:signal_types(label, nature, reliability)')
        .eq('company_id', companyId)
        // Un signal écarté par l'utilisateur (« Ce signal est faux ») ne sert pas au message
        .is('invalidated_at', null)
        .order('detected_at', { ascending: false })
        .limit(MAX_SIGNALS * 2),
      contactId
        ? supabase
            .from('company_contacts')
            .select('first_name, last_name, role, opted_out_at, email_source, phone')
            .eq('id', contactId)
            .eq('company_id', companyId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('user_profiles')
        .select('first_name, business_name, message_pitch, message_signature, profession:professions(label)')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('icp_profiles')
        .select('criteria, signal_recommendations')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('portfolio_references')
        .select('title, client_name, is_client_name_public, sector, summary, technologies, url, year')
        .eq('user_id', user.id)
        .order('year', { ascending: false, nullsFirst: false })
        .limit(MAX_REFERENCES),
      supabase
        .from('company_interactions')
        .select('occurred_at')
        .eq('company_id', companyId)
        .eq('direction', 'outgoing')
        .eq('status', 'done')
        .in('type', ['email', 'linkedin_message', 'whatsapp'])
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    for (const result of [company, signals, contact, profile, icp, references, lastOutgoing]) {
      if (result.error) throw result.error
    }

    if (!company.data) return json({ error: 'Entreprise introuvable' }, 404)
    if (contactId && !contact.data) return json({ error: 'Contact introuvable' }, 404)
    // RGPD : une personne qui a refusé d'être contactée ne l'est plus
    if (contact.data?.opted_out_at) {
      return json({ error: 'Cette personne a demandé à ne plus être contactée' }, 409)
    }
    if (channel === 'whatsapp' && !contact.data?.phone) {
      return json({ error: 'Ajoutez d\'abord le numéro de téléphone de ce contact' }, 409)
    }

    const now = Date.now()
    // Pistes de Sophie par type de signal (recommandation appliquée) : hypothèses, jamais des faits
    const recommendation = readSignalRecommendation((icp.data as { signal_recommendations?: unknown } | null)?.signal_recommendations)
    const advice = new Map(
      (recommendation?.events ?? []).flatMap((event) => {
        const signal = opportunityEvent(event.event)?.signal
        return signal ? [[signal, event] as const] : []
      })
    )
    const active = (signals.data ?? [])
      .filter((signal) => !signal.expires_at || new Date(signal.expires_at).getTime() > now)
      // Même règle que le score : un signal sans preuve (source officielle ou page) ne sert pas au message
      .filter((signal) => signal.source === 'bodacc' || signal.source === 'registry' || !!signal.source_url)
      .slice(0, MAX_SIGNALS)
    const activeSignals: SignalForMessage[] = active.map((signal) => ({
      id: signal.id,
      label: (signal.type as { label?: string } | null)?.label ?? 'Signal',
      details: signalDetails((signal.evidence ?? {}) as Record<string, unknown>),
      detectedAt: signal.detected_at,
      eventAt: (signal as { event_at?: string | null }).event_at ?? null,
      // Fait constaté, hypothèse à vérifier ou besoin exprimé (catalogue des signaux, 00054)
      nature: (signal.type as { nature?: string } | null)?.nature ?? 'observed',
      reliability: (signal.type as { reliability?: string } | null)?.reliability ?? 'medium',
      // Piste (hypothèse) et prestation : de l'analyse approfondie, sinon de la recommandation de Sophie
      ...signalLead((signal.evidence ?? {}) as Record<string, unknown>, advice.get(signal.signal_type as string)),
    }))

    // Recherche qui a trouvé la fiche : client direct, ou partenaire qui sous-traite
    const strategyId = (company.data as { strategy_id?: string | null }).strategy_id ?? null
    const { data: strategy } = strategyId
      ? await supabase.from('prospect_strategies').select('approach').eq('id', strategyId).maybeSingle()
      : { data: null }

    // Texte de l'offre d'emploi ou du post LinkedIn le plus récent : de quoi parler du vrai besoin
    const adText = (signal: (typeof active)[number]) => {
      const description = (signal.evidence as Record<string, unknown> | null)?.description
      return typeof description === 'string' ? description.trim().slice(0, MAX_JOB_AD_LENGTH) : ''
    }
    const adSignal = active.find((signal) => adText(signal) !== '')
    const sourceText = adSignal
      ? {
          signalId: adSignal.id,
          text: adText(adSignal),
          kind:
            (adSignal.evidence as Record<string, unknown> | null)?.source === 'linkedin_post'
              ? ('linkedin_post' as const)
              : ('job_ad' as const),
        }
      : null

    const criteria = (icp.data?.criteria ?? {}) as {
      tech_stack?: string[]
      remote?: string
      services?: { name?: unknown; description?: unknown }[]
      mission_mode?: { mode?: unknown; max_km?: unknown }
    }
    // Prestations écrites par la freelance (Mon offre) : nom et description seulement, jamais le prix
    const services = (Array.isArray(criteria.services) ? criteria.services : [])
      .filter((service) => typeof service?.name === 'string' && service.name.trim())
      .slice(0, 15)
      .map((service) => ({
        name: String(service.name).trim().slice(0, 80),
        description: typeof service.description === 'string' ? service.description.trim().slice(0, 200) : '',
      }))
    const missionMode = ['remote', 'onsite', 'both'].includes(String(criteria.mission_mode?.mode))
      ? (String(criteria.mission_mode?.mode) as 'remote' | 'onsite' | 'both')
      : null
    const maxKm = typeof criteria.mission_mode?.max_km === 'number' ? criteria.mission_mode.max_km : null
    const senderProfile = profile.data
    const website = company.data.website
    const siteText = website ? await fetchSiteText(website) : null

    const referenceRows = references.data ?? []
    const draft = await writeDraft(access, {
      channel,
      sender: {
        firstName: senderProfile?.first_name ?? null,
        businessName: senderProfile?.business_name ?? null,
        profession: (senderProfile?.profession as { label?: string } | null)?.label ?? null,
        pitch: senderProfile?.message_pitch ?? null,
        technologies: (criteria.tech_stack ?? []).map((tech) => TECHNOLOGY_LABELS[tech] ?? tech),
        remoteOnly: criteria.remote === 'only' || missionMode === 'remote',
        services,
        missionMode,
        maxKm,
      },
      approach: strategy?.approach === 'partner' ? 'partner' : strategy?.approach === 'profile' ? 'profile' : null,
      tone,
      // Le nom d'un client confidentiel n'est jamais donné à l'IA
      references: referenceRows.map((reference) => ({
        title: reference.title,
        client: reference.is_client_name_public ? reference.client_name : null,
        sector: reference.sector,
        summary: reference.summary,
        technologies: reference.technologies ?? [],
        url: reference.url,
        year: reference.year,
      })),
      company: {
        name: company.data.name,
        isIndividual: company.data.kind === 'individual',
        segment: company.data.segment ?? null,
        sector: company.data.sector,
        city: company.data.city,
        size: company.data.size_category ? (SIZE_LABELS[company.data.size_category] ?? null) : null,
        technologies: ((company.data.detected_stack ?? []) as string[]).map((tech) => TECHNOLOGY_LABELS[tech] ?? tech),
      },
      siteText,
      signals: activeSignals,
      sourceText,
      recipient: contact.data
        ? { firstName: contact.data.first_name, lastName: contact.data.last_name, role: contact.data.role }
        : null,
      instructions,
      afterInvitation,
      sequence,
    })

    const firstName = senderProfile?.first_name?.trim() || null
    const signature =
      channel === 'email'
        ? senderProfile?.message_signature?.trim() ||
          [firstName, senderProfile?.business_name?.trim()].filter(Boolean).join('\n') ||
          null
        : firstName

    const firstEmail = channel === 'email' && !lastOutgoing.data
    const optOutUrl = firstEmail && contactId ? await createOptOutLink(admin, user.id, contactId) : null
    const notice = firstEmail ? originNotice(contact.data?.email_source ?? null, company.data.name, optOutUrl) : null
    const checks = {
      channel,
      notice,
      signals: activeSignals,
      knownUrls: [website, ...referenceRows.map((reference) => reference.url)].filter(
        (url): url is string => typeof url === 'string' && url !== ''
      ),
      knownTexts: [
        senderProfile?.message_pitch ?? null,
        senderProfile?.message_signature ?? null,
        instructions,
        sourceText?.text ?? null,
      ],
      confidentialClients: referenceRows
        .filter((reference) => !reference.is_client_name_public && reference.client_name?.trim())
        .map((reference) => reference.client_name!.trim()),
      signature,
      lastOutgoingAt: lastOutgoing.data?.occurred_at ?? null,
    }
    await recordAiUsage(admin, user.id, access, 'draft')
    const checked = checkDraft(draft, checks)
    if (!sequence) return json(checked)

    // Les relances passent les mêmes vérifications, signature comprise
    const followUps = [draft.follow_up_1 ?? '', draft.follow_up_2 ?? ''].map((text, index) => {
      if (!text.trim()) return { body: '', warnings: [] as string[] }
      const result = checkDraft({ subject: '', body: text, angle: '', signal_id: '' }, { ...checks, lastOutgoingAt: null, followUp: true })
      return { body: result.body, warnings: result.warnings.map((warning) => `Relance ${index + 1} : ${warning}`) }
    })
    return json({
      ...checked,
      followUp1: followUps[0]!.body,
      followUp2: followUps[1]!.body,
      warnings: [...checked.warnings, ...followUps.flatMap((followUp) => followUp.warnings)],
    })
  } catch (error) {
    if (error instanceof UserFacingError) return json({ error: error.message }, 422)
    console.error('draft-message', error)
    return json({ error: 'Sophie n\'a pas pu rédiger ce message : réessayez dans un instant' }, 500)
  }
})
