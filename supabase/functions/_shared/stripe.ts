// Appels à l'API de Stripe (sans bibliothèque) et mise à jour de l'abonnement d'un compte.
// La clé secrète et le secret du webhook sont dans les secrets Supabase (STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET) : ils ne passent jamais par le site.

import type { SupabaseClient } from '@supabase/supabase-js'

const STRIPE_API = 'https://api.stripe.com/v1'

type Params = Record<string, string | number | boolean | undefined>

/** Appel à Stripe : paramètres encodés comme un formulaire, réponse JSON (erreur levée sinon) */
export async function stripeRequest<T = Record<string, unknown>>(
  path: string,
  params: Params = {},
  method: 'GET' | 'POST' | 'DELETE' = 'POST'
): Promise<T> {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('STRIPE_SECRET_KEY manque dans les secrets Supabase')
  const body = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) if (value !== undefined) body.set(name, String(value))
  const response = await fetch(`${STRIPE_API}/${path}${method === 'GET' && body.size ? `?${body}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    ...(method === 'GET' ? {} : { body }),
    signal: AbortSignal.timeout(20_000),
  })
  const json = (await response.json()) as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(`Stripe ${path} : ${json.error?.message ?? response.status}`)
  return json
}

export type StripeSubscription = {
  id: string
  customer: string
  status: string
  cancel_at_period_end: boolean
  /** Date de fin prévue d'un abonnement résilié (l'espace client la renseigne, plutôt que cancel_at_period_end) */
  cancel_at?: number | null
  current_period_end?: number
  metadata?: Record<string, string>
  items: { data: { current_period_end?: number; price: { lookup_key: string | null; recurring?: { interval?: string } } }[] }
}

const PLAN_FROM_LOOKUP = /^(essentiel|pro)_(monthly|yearly)$/

/**
 * Recopie l'état d'un abonnement Stripe dans la table billing (offre, période, statut, résiliation)
 */
export async function syncSubscription(admin: SupabaseClient, subscriptionId: string): Promise<string | null> {
  const subscription = await stripeRequest<StripeSubscription>(
    `subscriptions/${encodeURIComponent(subscriptionId)}`,
    { 'expand[]': 'items.data.price' },
    'GET'
  )
  const item = subscription.items.data[0]
  const match = item?.price.lookup_key?.match(PLAN_FROM_LOOKUP)
  const renewal = subscription.current_period_end ?? item?.current_period_end ?? null
  // Résilié : l'accès s'arrête à la date de fin prévue, sans nouveau prélèvement
  const cancelling = subscription.cancel_at_period_end || Boolean(subscription.cancel_at)
  const periodEnd = subscription.cancel_at && (!renewal || subscription.cancel_at < renewal) ? subscription.cancel_at : renewal

  // Le compte : celui inscrit dans l'abonnement à sa création, sinon celui du client Stripe
  let userId = subscription.metadata?.user_id ?? null
  if (!userId) {
    const { data } = await admin.from('billing').select('user_id').eq('stripe_customer_id', subscription.customer).maybeSingle()
    userId = (data?.user_id as string | undefined) ?? null
  }
  if (!userId) {
    console.error('stripe: abonnement sans compte connu', subscription.id)
    return null
  }

  const { error } = await admin
    .from('billing')
    .update({
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      plan: match?.[1] ?? null,
      billing_interval: match ? (match[2] === 'monthly' ? 'month' : 'year') : null,
      status: subscription.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: cancelling,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (error) throw error
  return userId
}

/** Signature Stripe (en-tête Stripe-Signature : t=…,v1=…), valable 5 minutes */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false
  const parts = header.split(',').map((part) => part.split('=') as [string, string])
  const timestamp = parts.find(([key]) => key === 't')?.[1]
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!timestamp || signatures.length === 0) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`))
  const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  // Comparaison en temps constant
  return signatures.some((signature) => {
    if (signature.length !== expected.length) return false
    let difference = 0
    for (let index = 0; index < expected.length; index++) difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index)
    return difference === 0
  })
}
