// Abonnement de l'utilisateur connecté : page de paiement Stripe (Checkout) ou espace client (portail).
//
// POST { action: 'checkout', plan: 'essentiel' | 'pro', interval: 'month' | 'year', origin }
//   → { url } de la page de paiement (ou de l'espace client si un abonnement existe déjà)
// POST { action: 'portal', origin } → { url } de l'espace client (gérer, changer d'offre, résilier)
// POST { action: 'sync' } → recopie l'abonnement depuis Stripe (au retour de la page de paiement)
//
// Appelée par le serveur du site avec le jeton de l'utilisateur ; pas d'en-têtes CORS.

import { createClient } from '@supabase/supabase-js'
import { stripeRequest, syncSubscription } from '../_shared/stripe.ts'

// Adresses de retour acceptées après le paiement : le site, ses aperçus Netlify et le développement local
const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?filonea\.(fr|com)$/,
  /^https:\/\/([a-z0-9-]+--)?lynkio\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
]
const DEFAULT_ORIGIN = 'https://filonea.fr'
// Un abonnement dans ces états donne accès : on n'en crée pas un second
const ONGOING = ['active', 'trialing', 'past_due']
// Stripe exige qu'une fin d'essai soit au moins 48 heures plus tard
const MIN_TRIAL_MS = 49 * 60 * 60 * 1000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)
  const input = (await request.json().catch(() => null)) as
    | { action?: string; plan?: string; interval?: string; origin?: string }
    | null
  const origin = input?.origin && ALLOWED_ORIGINS.some((allowed) => allowed.test(input.origin!)) ? input.origin : DEFAULT_ORIGIN

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(token)
  const user = auth?.user
  if (!user) return json({ error: 'Vous devez être connecté' }, 401)

  const { data: billing, error: billingError } = await admin
    .from('billing')
    .select('stripe_customer_id, stripe_subscription_id, status, trial_ends_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (billingError || !billing) return json({ error: 'Abonnement introuvable' }, 500)

  try {
    if (input?.action === 'sync') {
      if (billing.stripe_subscription_id) await syncSubscription(admin, billing.stripe_subscription_id)
      else if (billing.stripe_customer_id) {
        // Retour de la page de paiement avant la notification de Stripe : on cherche l'abonnement
        const list = await stripeRequest<{ data: { id: string }[] }>(
          'subscriptions',
          { customer: billing.stripe_customer_id, status: 'all', limit: 1 },
          'GET'
        )
        if (list.data[0]) await syncSubscription(admin, list.data[0].id)
      }
      return json({ synced: true })
    }

    const portal = async () => {
      const session = await stripeRequest<{ url: string }>('billing_portal/sessions', {
        customer: billing.stripe_customer_id!,
        // Au retour, la page recopie l'abonnement modifié sans attendre la notification de Stripe
        return_url: `${origin}/billing?maj=1`,
        locale: 'fr',
      })
      return json({ url: session.url })
    }

    if (input?.action === 'portal') {
      if (!billing.stripe_customer_id) return json({ error: 'Aucun abonnement à gérer pour le moment' }, 400)
      return await portal()
    }

    if (input?.action !== 'checkout') return json({ error: 'Demande invalide' }, 400)
    const plan = input.plan === 'essentiel' || input.plan === 'pro' ? input.plan : null
    const interval = input.interval === 'month' || input.interval === 'year' ? input.interval : null
    if (!plan || !interval) return json({ error: 'Offre invalide' }, 400)

    // Déjà abonné : on ouvre l'espace client, où l'on change d'offre sans payer deux fois
    if (billing.stripe_customer_id && billing.status && ONGOING.includes(billing.status)) return await portal()

    let customerId = billing.stripe_customer_id
    if (!customerId) {
      const customer = await stripeRequest<{ id: string }>('customers', {
        email: user.email ?? undefined,
        'metadata[user_id]': user.id,
        'preferred_locales[]': 'fr',
      })
      customerId = customer.id
      const { error } = await admin.from('billing').update({ stripe_customer_id: customerId }).eq('user_id', user.id)
      if (error) throw error
    }

    const lookupKey = `${plan}_${interval === 'month' ? 'monthly' : 'yearly'}`
    const prices = await stripeRequest<{ data: { id: string }[] }>(
      'prices',
      { 'lookup_keys[]': lookupKey, active: true, limit: 1 },
      'GET'
    )
    const priceId = prices.data[0]?.id
    if (!priceId) throw new Error(`Prix ${lookupKey} introuvable dans Stripe`)

    // Abonnement pris pendant l'essai : le premier prélèvement attend la fin de l'essai
    const trialEnd = new Date(billing.trial_ends_at).getTime()
    const keepTrial = trialEnd - Date.now() > MIN_TRIAL_MS

    const session = await stripeRequest<{ url: string }>('checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
      client_reference_id: user.id,
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[trial_end]': keepTrial ? Math.floor(trialEnd / 1000) : undefined,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'fr',
      success_url: `${origin}/billing?paiement=ok`,
      cancel_url: `${origin}/billing`,
    })
    return json({ url: session.url })
  } catch (error) {
    console.error('billing', input?.action, error instanceof Error ? error.message : error)
    return json({ error: 'Le paiement est indisponible pour le moment : réessayez dans un instant.' }, 502)
  }
})
