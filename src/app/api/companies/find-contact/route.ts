import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toWebsiteDomain } from '@/lib/validations/company'

const HUNTER_DOMAIN_SEARCH_URL = 'https://api.hunter.io/v2/domain-search'
const HUNTER_EMAIL_FINDER_URL = 'https://api.hunter.io/v2/email-finder'

// Équivalents anglais des postes de décideurs : Hunter renvoie surtout des
// intitulés en anglais (« Founder », « CEO »…), alors que les postes à cibler
// du métier (professions.target_roles) sont écrits en français.
const ENGLISH_DECISION_ROLES = [
  'founder',
  'co-founder',
  'cofounder',
  'owner',
  'ceo',
  'chief executive officer',
  'managing director',
  'general manager',
  'cto',
  'chief technology officer',
  'chief technical officer',
  'chief information officer',
  'vp engineering',
  'vp of engineering',
  'head of engineering',
  'head of technology',
  'engineering manager',
  'tech lead',
  'technical lead',
  'lead developer',
  'cmo',
  'chief marketing officer',
  'head of marketing',
  'marketing director',
]

// Postes utilisés si le métier n'est pas renseigné
const DEFAULT_TARGET_ROLES = ['fondateur', 'fondatrice', 'gérant', 'gérante', 'directeur général', 'directrice générale']

// Comparaison sans accents ni casse : « Gérante » et « gerante » se valent
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Postes à cibler pour le métier de l'utilisateur, en expressions régulières.
 * Comparés avec une limite de mot (\b) et non un simple `includes()` : un sigle
 * court comme « cto » apparaît sinon par accident DANS des mots courants
 * (« dire-cto-r »).
 */
async function targetRolePatterns(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<RegExp[]> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('profession_key')
    .eq('id', userId)
    .maybeSingle()

  const { data: profession } = profile?.profession_key
    ? await supabase.from('professions').select('target_roles').eq('key', profile.profession_key).maybeSingle()
    : { data: null }

  const roles = [...(profession?.target_roles?.length ? profession.target_roles : DEFAULT_TARGET_ROLES), ...ENGLISH_DECISION_ROLES]

  return [...new Set(roles.map(normalize))].map(
    (role) => new RegExp(`\\b${escapeRegExp(role).replace(/\s+/g, '\\s+')}\\b`)
  )
}

function isTargetRole(position: string | null, patterns: RegExp[]): boolean {
  const normalized = normalize(position || '')
  return patterns.some((pattern) => pattern.test(normalized))
}

type HunterEmail = {
  value: string
  first_name: string | null
  last_name: string | null
  position: string | null
  seniority: 'junior' | 'senior' | 'executive' | null
  department: string | null
  decision_maker: boolean | null
  linkedin: string | null
  confidence: number | null
}

type HunterPerson = {
  email: string | null
  first_name: string | null
  last_name: string | null
  position: string | null
  linkedin_url: string | null
  score: number | null
}

type Candidate = {
  name: string | null
  position: string | null
  email: string
  linkedinUrl: string | null
  confidence: number | null
  seniority: string | null
  // Poste correspondant à ceux que vise le métier de l'utilisateur
  isTargetRole: boolean
}

function sortScore(email: Pick<HunterEmail, 'department' | 'seniority' | 'decision_maker'>, titleMatch: boolean): number {
  let score = titleMatch ? 10 : 0

  if (email.department === 'it' && email.seniority === 'executive') {
    score += 2
  }
  if (email.decision_maker) {
    score += 1
  }

  return score
}

function handleHunterError(status: number) {
  if (status === 401 || status === 403) {
    return NextResponse.json(
      { error: 'Clé API Hunter.io invalide ou quota dépassé' },
      { status }
    )
  }
  if (status === 429) {
    return NextResponse.json(
      { error: 'Trop de requêtes envoyées à Hunter.io, réessayez dans un instant' },
      { status: 429 }
    )
  }
  return NextResponse.json(
    { error: 'Impossible d\'interroger Hunter.io pour le moment' },
    { status: 502 }
  )
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const apiKey = process.env.HUNTER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'La clé API Hunter.io n\'est pas configurée sur le serveur' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => null)
    const website = body && typeof body.website === 'string' ? body.website : null
    const firstName = body && typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = body && typeof body.lastName === 'string' ? body.lastName.trim() : ''

    if (!website) {
      return NextResponse.json({ error: 'Le site web est requis' }, { status: 400 })
    }

    const domain = toWebsiteDomain(website)
    const rolePatterns = await targetRolePatterns(supabase, user.id)
    if (!domain) {
      return NextResponse.json({ error: 'Impossible d\'extraire un nom de domaine de cette URL' }, { status: 400 })
    }

    // Recherche ciblée par nom (Email Finder) plutôt que le balayage global du
    // domaine (Domain Search) : utile quand la personne cherchée n'est pas
    // dans le top 10 remonté par le plan gratuit (ex: pas assez de présence
    // publique face aux profils "executive" que Hunter priorise). Hunter ne
    // facture aucun crédit quand cette recherche ciblée ne trouve rien.
    if (firstName && lastName) {
      const finderUrl = `${HUNTER_EMAIL_FINDER_URL}?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}`

      const response = await fetch(finderUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })

      if (!response.ok && response.status !== 404) {
        return handleHunterError(response.status)
      }

      const json = await response.json().catch(() => null)
      const person: HunterPerson | null = json?.data || null

      if (!person || !person.email) {
        return NextResponse.json({ domain, organization: null, candidates: [], totalFound: 0 })
      }

      const titleMatch = isTargetRole(person.position, rolePatterns)
      const candidates: Candidate[] = [
        {
          name: [person.first_name, person.last_name].filter(Boolean).join(' ') || null,
          position: person.position,
          email: person.email,
          linkedinUrl: person.linkedin_url,
          confidence: person.score,
          seniority: null,
          isTargetRole: titleMatch,
        },
      ]

      return NextResponse.json({ domain, organization: null, candidates, totalFound: 1 })
    }

    const searchUrl = `${HUNTER_DOMAIN_SEARCH_URL}?domain=${encodeURIComponent(domain)}&limit=10`

    const response = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!response.ok) {
      return handleHunterError(response.status)
    }

    const json = await response.json()
    const emails: HunterEmail[] = json?.data?.emails || []

    const ranked = emails
      .filter((email) => !!email.value)
      .map((email) => {
        const titleMatch = isTargetRole(email.position, rolePatterns)
        const candidate: Candidate = {
          name: [email.first_name, email.last_name].filter(Boolean).join(' ') || null,
          position: email.position,
          email: email.value,
          linkedinUrl: email.linkedin,
          confidence: email.confidence,
          seniority: email.seniority,
          isTargetRole: titleMatch,
        }
        return { candidate, score: sortScore(email, titleMatch) }
      })
      .sort((a, b) => b.score - a.score)

    const candidates: Candidate[] = ranked.map((r) => r.candidate)

    return NextResponse.json({
      domain,
      organization: json?.data?.organization || null,
      candidates,
      totalFound: emails.length,
    })
  } catch (error) {
    console.error('Find contact error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
