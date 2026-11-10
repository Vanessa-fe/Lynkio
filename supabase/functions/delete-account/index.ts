// Suppression définitive du compte de l'utilisateur connecté (droit à l'effacement, RGPD).
//
// POST { confirm: 'SUPPRIMER' }. Réponse : { deleted: true }.
//
// Supprimer le compte (auth.users) efface en cascade toutes ses données : profil, entreprises,
// personnes, échanges, listes, réglages, clés chiffrées du coffre. Appelée par le serveur du site
// avec le jeton de l'utilisateur ; pas d'en-têtes CORS, un navigateur ne peut pas l'appeler directement.

import { createClient } from '@supabase/supabase-js'

const CONFIRMATION = 'SUPPRIMER'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const input = (await request.json().catch(() => null)) as { confirm?: unknown } | null
  if (input?.confirm !== CONFIRMATION) return json({ error: `Écrivez ${CONFIRMATION} pour confirmer` }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(token)
  const userId = auth?.user?.id
  if (!userId) return json({ error: 'Vous devez être connecté' }, 401)

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    console.error('delete-account', error.message)
    return json({ error: 'Suppression impossible pour le moment : réessayez, ou écrivez-nous.' }, 500)
  }

  return json({ deleted: true })
})
