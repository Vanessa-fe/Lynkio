// Sophie prépare un premier message (e-mail ou LinkedIn) pour une entreprise.
//
// POST, JSON : { companyId, channel: "email" | "linkedin_message", contactId?, instructions? }
// Réponse : { subject, body, angle, signal, warnings }. Rien n'est enregistré ici :
// l'application enregistre le brouillon si l'utilisatrice le garde.
//
// Appelée directement depuis le navigateur, pas par une action serveur : Netlify
// coupe une action au bout d'une dizaine de secondes, et la rédaction en prend
// souvent plus. La passerelle vérifie le jeton de l'utilisatrice (verify_jwt), et
// la fonction lit la base avec ce même jeton : les règles RLS s'appliquent, elle
// ne voit que ses données.

import { createClient } from '@supabase/supabase-js'
import { TECHNOLOGY_LABELS } from '../prospection-run/detect-tech-users.ts'
import { checkDraft } from './checks.ts'
import { fetchSiteText } from './site-text.ts'
import { UserFacingError, writeDraft, type Channel, type SignalForMessage } from './writer.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_INSTRUCTIONS_LENGTH = 500
const MAX_SIGNALS = 5
const MAX_REFERENCES = 10

// Le site en production (et ses aperçus de déploiement Netlify), et le développement local
const ALLOWED_ORIGINS = [/^https:\/\/([a-z0-9-]+--)?lynkio\.netlify\.app$/, /^http:\/\/localhost:\d+$/]

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

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get('Origin'))
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  let input: { companyId?: unknown; channel?: unknown; contactId?: unknown; instructions?: unknown }
  try {
    input = await request.json()
  } catch {
    return json({ error: 'Corps de requête invalide' }, 400)
  }

  const companyId = typeof input.companyId === 'string' && UUID.test(input.companyId) ? input.companyId : null
  const channel: Channel | null =
    input.channel === 'email' || input.channel === 'linkedin_message' ? input.channel : null
  const contactId = typeof input.contactId === 'string' && UUID.test(input.contactId) ? input.contactId : null
  const instructions =
    typeof input.instructions === 'string' ? input.instructions.trim().slice(0, MAX_INSTRUCTIONS_LENGTH) || null : null

  if (!companyId || !channel) return json({ error: 'Entreprise ou canal invalide' }, 400)

  const authorization = request.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: auth } = await supabase.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  const user = auth?.user
  if (!user) return json({ error: 'Vous devez être connecté' }, 401)

  try {
    const [company, signals, contact, profile, icp, references, lastOutgoing] = await Promise.all([
      supabase
        .from('companies')
        .select('name, kind, sector, city, size_category, website, detected_stack')
        .eq('id', companyId)
        .maybeSingle(),
      supabase
        .from('company_signals')
        .select('id, evidence, detected_at, expires_at, type:signal_types(label)')
        .eq('company_id', companyId)
        .order('detected_at', { ascending: false })
        .limit(MAX_SIGNALS * 2),
      contactId
        ? supabase
            .from('company_contacts')
            .select('first_name, last_name, role, opted_out_at')
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
        .select('criteria')
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
        .in('type', ['email', 'linkedin_message'])
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

    const now = Date.now()
    const activeSignals: SignalForMessage[] = (signals.data ?? [])
      .filter((signal) => !signal.expires_at || new Date(signal.expires_at).getTime() > now)
      .slice(0, MAX_SIGNALS)
      .map((signal) => ({
        id: signal.id,
        label: (signal.type as { label?: string } | null)?.label ?? 'Signal',
        details: signalDetails((signal.evidence ?? {}) as Record<string, unknown>),
        detectedAt: signal.detected_at,
      }))

    const criteria = (icp.data?.criteria ?? {}) as { tech_stack?: string[]; remote?: string }
    const senderProfile = profile.data
    const website = company.data.website
    const siteText = website ? await fetchSiteText(website) : null

    const referenceRows = references.data ?? []
    const draft = await writeDraft({
      channel,
      sender: {
        firstName: senderProfile?.first_name ?? null,
        businessName: senderProfile?.business_name ?? null,
        profession: (senderProfile?.profession as { label?: string } | null)?.label ?? null,
        pitch: senderProfile?.message_pitch ?? null,
        technologies: (criteria.tech_stack ?? []).map((tech) => TECHNOLOGY_LABELS[tech] ?? tech),
        remoteOnly: criteria.remote === 'only',
      },
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
        sector: company.data.sector,
        city: company.data.city,
        size: company.data.size_category ? (SIZE_LABELS[company.data.size_category] ?? null) : null,
        technologies: ((company.data.detected_stack ?? []) as string[]).map((tech) => TECHNOLOGY_LABELS[tech] ?? tech),
      },
      siteText,
      signals: activeSignals,
      recipient: contact.data
        ? { firstName: contact.data.first_name, lastName: contact.data.last_name, role: contact.data.role }
        : null,
      instructions,
    })

    const firstName = senderProfile?.first_name?.trim() || null
    const signature =
      channel === 'email'
        ? senderProfile?.message_signature?.trim() ||
          [firstName, senderProfile?.business_name?.trim()].filter(Boolean).join('\n') ||
          null
        : firstName

    return json(
      checkDraft(draft, {
        channel,
        signals: activeSignals,
        knownUrls: [website, ...referenceRows.map((reference) => reference.url)].filter(
          (url): url is string => typeof url === 'string' && url !== ''
        ),
        knownTexts: [senderProfile?.message_pitch ?? null, senderProfile?.message_signature ?? null, instructions],
        confidentialClients: referenceRows
          .filter((reference) => !reference.is_client_name_public && reference.client_name?.trim())
          .map((reference) => reference.client_name!.trim()),
        signature,
        lastOutgoingAt: lastOutgoing.data?.occurred_at ?? null,
      })
    )
  } catch (error) {
    if (error instanceof UserFacingError) return json({ error: error.message }, 422)
    console.error('draft-message', error)
    return json({ error: 'Sophie n\'a pas pu rédiger ce message : réessayez dans un instant' }, 500)
  }
})
