// Connexion de l'extension Chrome de Filonea au compte de l'utilisatrice.
//
// POST, sans corps. Réponse : { tokenHash, email }.
//
// La page Paramètres appelle cette fonction puis transmet `tokenHash` à l'extension,
// qui l'échange contre sa propre session (verifyOtp). L'extension a ainsi une session
// à elle : si elle partageait celle du site, chacune renouvellerait le même jeton et
// Supabase finirait par les déconnecter toutes les deux.
//
// Le jeton est celui d'un lien de connexion par e-mail, mais aucun e-mail n'est envoyé.
// Il est à usage unique, expire vite, et ne vaut que pour le compte qui l'a demandé.

import { createClient } from '@supabase/supabase-js'

// Le site en production (filonea.fr, filonea.com, et l'adresse Netlify avec ses aperçus de déploiement),
// et le développement local
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

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get('Origin'))
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const { data: auth } = await admin.auth.getUser(token)
  const email = auth?.user?.email
  if (!email) return json({ error: 'Vous devez être connecté' }, 401)

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) {
    console.error('extension-connect', error)
    return json({ error: 'Impossible de connecter l\'extension : réessayez dans un instant' }, 500)
  }

  return json({ tokenHash, email })
})
