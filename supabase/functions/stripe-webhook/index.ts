// Notifications de Stripe (webhook) : paiement réussi, abonnement créé, changé ou résilié, échec de
// paiement. Chaque notification signée met à jour l'abonnement du compte dans la table billing.
// Une notification mal signée est refusée (400) ; une erreur (500) fait réessayer Stripe plus tard.

import { createClient } from '@supabase/supabase-js'
import { syncSubscription, verifyStripeSignature } from '../_shared/stripe.ts'

type StripeEvent = {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

// Abonnement concerné par la notification, selon son type
function subscriptionIdOf(event: StripeEvent): string | null {
  const object = event.data.object
  if (event.type.startsWith('customer.subscription.')) return typeof object.id === 'string' ? object.id : null
  if (typeof object.subscription === 'string') return object.subscription
  const parent = object.parent as { subscription_details?: { subscription?: string } } | undefined
  return parent?.subscription_details?.subscription ?? null
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!secret) return new Response('Webhook non configuré', { status: 500 })

  const payload = await request.text()
  if (!(await verifyStripeSignature(payload, request.headers.get('Stripe-Signature'), secret))) {
    return new Response('Signature invalide', { status: 400 })
  }

  const event = JSON.parse(payload) as StripeEvent
  const subscriptionId = subscriptionIdOf(event)
  if (!subscriptionId) return new Response(JSON.stringify({ ignored: event.type }), { status: 200 })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  try {
    const userId = await syncSubscription(admin, subscriptionId)
    console.log('stripe-webhook', event.type, subscriptionId, userId ? 'à jour' : 'compte introuvable')
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('stripe-webhook', event.type, error instanceof Error ? error.message : error)
    return new Response('Erreur', { status: 500 })
  }
})
