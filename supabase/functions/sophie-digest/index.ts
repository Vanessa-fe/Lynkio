// Reformulation facultative du bilan hebdomadaire avec la clé IA de l'utilisateur (BYOK).
// Appelée depuis le navigateur, avec le jeton de l'utilisateur (verify_jwt). Seuls les totaux et la
// période sont envoyés à l'IA ; 5 reformulations par jour au plus.
import { createClient } from '@supabase/supabase-js'
import { loadAiAccess, generateJson } from '../_shared/ai.ts'
import { UserFacingError } from '../_shared/errors.ts'
import { accountPlan, planDenial } from '../_shared/plan.ts'

// Même liste que les autres fonctions appelées depuis le navigateur (draft-message, strategy-assistant)
const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?filonea\.(fr|com)$/,
  /^https:\/\/([a-z0-9-]+--)?lynkio\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
]

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.some((allowed) => allowed.test(origin))) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

/** Jour (AAAA-MM-JJ) à l'heure de Paris ; shiftMs décale l'instant avant conversion */
function parisDay(value: string | null, shiftMs = 0): string | null {
  if (!value) return null
  const date = new Date(new Date(value).getTime() + shiftMs)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

Deno.serve(async request => {
  const cors = corsHeaders(request.headers.get('Origin'))
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return json({ error: 'Méthode invalide' }, 405)
  const body = await request.json().catch(() => null)
  if (typeof body?.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.id)) return json({ error: 'Bilan invalide' }, 400)
  const url = Deno.env.get('SUPABASE_URL')!
  const auth = request.headers.get('Authorization') ?? ''
  const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await client.auth.getUser(auth.replace(/^Bearer\s+/i, ''))
  if (!user) return json({ error: 'Connectez-vous pour lire ce bilan.' }, 401)
  try {
    const { data: report, error } = await client.from('sophie_notifications')
      .select('period_start,period_end,counts').eq('id', body.id).eq('user_id', user.id).eq('kind', 'digest').maybeSingle()
    if (error) throw error
    if (!report) return json({ error: 'Bilan introuvable.' }, 404)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const denial = planDenial(await accountPlan(admin, user.id), false)
    if (denial) return json({ error: denial.message }, 403)
    const access = await loadAiAccess(admin, user.id)
    const { data: allowed, error: limitError } = await client.rpc('hit_my_rate_limit', {
      p_action: 'sophie_digest', p_max: 5, p_window_seconds: 86400,
    })
    if (limitError) throw limitError
    if (!allowed) return json({ error: 'Limite quotidienne de reformulations atteinte.' }, 429)
    const result = await generateJson({
      access, name: 'weekly_digest', timeoutMs: 25000, task: 'La reformulation',
      schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'], additionalProperties: false },
      instructions: 'Reformule en français en deux phrases les seuls nombres fournis, pour la période du « du » au « au » (dates incluses, à reprendre telles quelles). outgoing et incoming sont les échanges sortants et entrants, meetings les rendez-vous et notes les notes. Aucun conseil ni déduction.',
      // Dates déjà à l'heure de Paris, dernier jour inclus (la période s'arrête le lundi à 0 h, exclu)
      input: JSON.stringify({ du: parisDay(report.period_start), au: parisDay(report.period_end, -1), totaux: report.counts }),
      webSearch: false,
    })
    const summary = JSON.parse(result.text)?.summary
    if (typeof summary !== 'string' || !summary.trim()) throw new Error('Réponse vide')
    return json({ summary: summary.slice(0, 1500) })
  } catch (error) {
    return json({ error: error instanceof UserFacingError ? error.message : 'La reformulation est indisponible.' }, 400)
  }
})
