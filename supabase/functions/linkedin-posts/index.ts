// Posts LinkedIn trouvés par l'extension Chrome (recherche par mots-clés, toutes les 2 heures).
//
// POST, JSON : { posts: [{ urn, url, authorName, authorHeadline?, authorProfileUrl?, text, postedAt?, keyword? }] }
// authorProfileUrl : linkedin.com/in/… pour une personne, linkedin.com/company/… pour une page entreprise.
// Réponse : { received, known, kept, filtered }.
//
// Appelée par l'extension avec la session de l'utilisatrice (la passerelle vérifie le
// jeton). Les posts déjà connus sont ignorés ; les autres sont triés, d'abord par le
// code (langue, intermédiaires, mots-clés exclus), puis par l'IA (en français ? vraie
// demande ? client direct ? son métier ?). Tous sont gardés : à traiter (new) ou écartés
// avec leur raison (filtered), pour que l'utilisatrice puisse vérifier le tri.

import { createClient } from '@supabase/supabase-js'
import { accountPlan, planDenial } from '../_shared/plan.ts'
import { TECHNOLOGY_LABELS } from '../prospection-run/detect-tech-users.ts'
import { matchesExcludedKeyword, truncate } from '../prospection-run/rules.ts'
import { sortPosts, type SortedPost } from './sorting.ts'
import { loadAiAccess } from '../_shared/ai.ts'
import { clearlyEnglish, notFrenchReason } from './language.ts'

const MAX_POSTS = 50
const MAX_TEXT_LENGTH = 5000
const POST_URN = /^urn:li:[A-Za-z]+:[0-9]+$/
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

type IncomingPost = {
  urn: string
  url: string
  authorName: string
  authorHeadline: string | null
  // Profil d'une personne ; null pour une page entreprise (authorIsCompany)
  authorProfileUrl: string | null
  authorIsCompany: boolean
  text: string
  postedAt: string | null
  keyword: string | null
}

type PostRow = {
  user_id: string
  post_urn: string
  post_url: string
  author_name: string
  author_headline: string | null
  author_linkedin_url: string | null
  text: string
  posted_at: string | null
  keyword: string | null
  summary: string | null
  company_name: string | null
  email: string | null
  status: 'new' | 'filtered'
  filter_reason: string | null
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() ? truncate(value.trim(), max) : null

// Même forme que normalizeLinkedinProfileUrl côté site : https://www.linkedin.com/in/<nom>/
function profileUrl(value: unknown): string | null {
  const match = typeof value === 'string' ? value.trim().match(/^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#\s]+)/i) : null
  return match?.[1] ? `https://www.linkedin.com/in/${decodeURIComponent(match[1]).replace(/\s+/g, '')}/` : null
}

function parsePost(value: unknown): IncomingPost | null {
  const post = (value ?? {}) as Record<string, unknown>
  const urn = typeof post.urn === 'string' && POST_URN.test(post.urn) ? post.urn : null
  const url = typeof post.url === 'string' && /^https:\/\/www\.linkedin\.com\//.test(post.url) ? text(post.url, 500) : null
  const authorName = text(post.authorName, 200)
  const body = text(post.text, MAX_TEXT_LENGTH)
  if (!urn || !url || !authorName || !body) return null
  const postedAt = typeof post.postedAt === 'string' && !Number.isNaN(Date.parse(post.postedAt)) ? post.postedAt : null
  return {
    urn,
    url,
    authorName,
    authorHeadline: text(post.authorHeadline, 500),
    authorProfileUrl: profileUrl(post.authorProfileUrl),
    authorIsCompany: typeof post.authorProfileUrl === 'string' && /linkedin\.com\/company\//i.test(post.authorProfileUrl),
    text: body,
    postedAt,
    keyword: text(post.keyword, 100),
  }
}

/** Raison d'écarter un post sans demander à l'IA, ou null */
function ruleOut(post: IncomingPost, excludedKeywords: string[]): string | null {
  if (!post.authorProfileUrl && !post.authorIsCompany) return 'Auteur introuvable sur LinkedIn'
  if (clearlyEnglish(post.text)) return notFrenchReason('en')
  // Les missions relayées par un recruteur, une ESN ou une plateforme sont gardées (choix du 9 novembre 2026)
  const all = `${post.authorHeadline ?? ''}\n${post.text}`
  const keyword = matchesExcludedKeyword(all, excludedKeywords)
  if (keyword) return `Contient un mot-clé exclu (« ${keyword} »)`
  return null
}

/** Raison d'écarter un post d'après le verdict de l'IA, ou null s'il est retenu */
function aiReason(sorted: SortedPost): string | null {
  if (sorted.language && sorted.language !== 'fr') return notFrenchReason(sorted.language)
  if (sorted.isRequest && sorted.matchesTrade) return null
  const prefix = !sorted.isRequest ? 'Pas une demande de freelance' : 'Hors de votre métier'
  return truncate(sorted.reason ? `${prefix} : ${sorted.reason}` : prefix, 300)
}

Deno.serve(async (request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  let input: { posts?: unknown }
  try {
    input = await request.json()
  } catch {
    return json({ error: 'Corps de requête invalide' }, 400)
  }
  if (!Array.isArray(input.posts) || input.posts.length > MAX_POSTS) {
    return json({ error: `Une liste de ${MAX_POSTS} posts au plus est attendue` }, 400)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const { data: auth } = await admin.auth.getUser(token)
  const userId = auth?.user?.id
  if (!userId) return json({ error: 'Vous devez être connecté' }, 401)

  // Recherche de posts par l'extension : offre Pro
  const denial = planDenial(await accountPlan(admin, userId), true)
  if (denial) return json({ error: denial.message, code: denial.code }, 403)

  try {
    // Un même post peut sortir de deux mots-clés : gardé une fois
    const posts = [
      ...new Map(
        input.posts
          .map(parsePost)
          .filter((post): post is IncomingPost => post !== null)
          .map((post) => [post.urn, post])
      ).values(),
    ]

    const [known, profile, icp] = await Promise.all([
      posts.length > 0
        ? admin
            .from('linkedin_posts')
            .select('post_urn')
            .eq('user_id', userId)
            .in('post_urn', posts.map((post) => post.urn))
        : Promise.resolve({ data: [], error: null }),
      admin.from('user_profiles').select('profession:professions(label)').eq('id', userId).maybeSingle(),
      admin
        .from('icp_profiles')
        .select('criteria')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at')
        .limit(1)
        .maybeSingle(),
    ])
    for (const result of [known, profile, icp]) {
      if (result.error) throw result.error
    }

    const knownUrns = new Set((known.data ?? []).map((row) => row.post_urn))
    const fresh = posts.filter((post) => !knownUrns.has(post.urn))

    const criteria = (icp.data?.criteria ?? {}) as { tech_stack?: unknown; exclude_keywords?: unknown }
    const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
    const excludedKeywords = strings(criteria.exclude_keywords)

    const ruledOut = fresh.map((post) => ruleOut(post, excludedKeywords))
    const toSort = fresh.filter((_, index) => ruledOut[index] === null)

    // Sans IA (clé absente, OpenAI indisponible), les posts restent à traiter, non triés : rien n'est perdu
    let verdicts: (SortedPost | null)[] = toSort.map(() => null)
    try {
      verdicts = await sortPosts(
        await loadAiAccess(admin, userId),
        toSort.map((post) => ({
          authorCompany: post.authorIsCompany ? post.authorName : null,
          authorHeadline: post.authorHeadline,
          text: post.text,
        })),
        {
          profession: (profile.data?.profession as { label?: string } | null)?.label ?? null,
          technologies: strings(criteria.tech_stack).map((tech) => TECHNOLOGY_LABELS[tech] ?? tech),
        }
      )
    } catch (error) {
      console.error('linkedin-posts sorting', error)
    }
    const verdictOf = new Map(toSort.map((post, index) => [post.urn, verdicts[index] ?? null]))

    const rows: PostRow[] = fresh.map((post, index) => {
      const sorted = verdictOf.get(post.urn) ?? null
      const reason = ruledOut[index] ?? (sorted ? aiReason(sorted) : null)
      return {
        user_id: userId,
        post_urn: post.urn,
        post_url: post.url,
        author_name: post.authorName,
        author_headline: post.authorHeadline,
        author_linkedin_url: post.authorProfileUrl,
        text: post.text,
        posted_at: post.postedAt,
        keyword: post.keyword,
        summary: sorted?.summary || null,
        // Une page entreprise parle pour elle-même
        company_name: sorted?.companyName ?? (post.authorIsCompany ? post.authorName : null),
        email: post.text.match(EMAIL)?.[0]?.toLowerCase().slice(0, 255) ?? null,
        status: reason ? 'filtered' : 'new',
        filter_reason: reason,
      }
    })

    if (rows.length > 0) {
      // Deux envois en même temps : le second ignore ce que le premier vient d'écrire
      const { error } = await admin.from('linkedin_posts').upsert(rows, { onConflict: 'user_id,post_urn', ignoreDuplicates: true })
      if (error) throw error
    }

    const { error: searchError } = await admin
      .from('linkedin_automation')
      // Recherche réussie : la raison d'un échec précédent n'a plus lieu d'être
      .upsert(
        { user_id: userId, post_search_at: new Date().toISOString(), post_search_error: null },
        { onConflict: 'user_id' }
      )
    if (searchError) throw searchError

    return json({
      received: posts.length,
      known: posts.length - fresh.length,
      kept: rows.filter((row) => row.status === 'new').length,
      filtered: rows.filter((row) => row.status === 'filtered').length,
    })
  } catch (error) {
    console.error('linkedin-posts', error)
    return json({ error: 'Les posts n\'ont pas pu être enregistrés : ils le seront à la prochaine recherche' }, 500)
  }
})
