'use server'

import { headers } from 'next/headers'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { captureServerError } from '@/lib/posthog-server'

type BillingResult = { url?: string; error?: string }

const UNAVAILABLE = 'Le paiement est indisponible pour le moment : réessayez dans un instant.'

/** Adresse du site vue par le navigateur, pour revenir au bon endroit après Stripe */
async function currentOrigin(): Promise<string | undefined> {
  const list = await headers()
  const origin = list.get('origin')
  if (origin) return origin
  const host = list.get('x-forwarded-host') ?? list.get('host')
  if (!host) return undefined
  return `${list.get('x-forwarded-proto') ?? 'https'}://${host}`
}

async function callBilling(body: Record<string, string>): Promise<BillingResult> {
  const user = await getAuthUser()
  if (!user) return { error: 'Vous devez être connecté' }
  const supabase = await createClient()
  try {
    const { data, error } = await supabase.functions.invoke<BillingResult>('billing', {
      body: { ...body, origin: await currentOrigin() },
    })
    if (error) {
      const detail =
        error instanceof FunctionsHttpError
          ? ((await error.context.json().catch(() => null)) as BillingResult | null)?.error
          : null
      return { error: detail ?? UNAVAILABLE }
    }
    return data ?? { error: UNAVAILABLE }
  } catch (error) {
    captureServerError(error, user.id, { action: `billing_${body.action}` })
    return { error: UNAVAILABLE }
  }
}

/** Page de paiement Stripe pour une offre (ou l'espace client si un abonnement existe déjà) */
export async function startCheckout(plan: string, interval: string): Promise<BillingResult> {
  if (!['essentiel', 'pro'].includes(plan) || !['month', 'year'].includes(interval)) return { error: 'Offre invalide' }
  return callBilling({ action: 'checkout', plan, interval })
}

/** Espace client Stripe : changer d'offre ou de carte, factures, résiliation */
export async function openBillingPortal(): Promise<BillingResult> {
  return callBilling({ action: 'portal' })
}

/** Recopie l'abonnement depuis Stripe, au retour de la page de paiement (avant la notification de Stripe) */
export async function syncBilling(): Promise<void> {
  await callBilling({ action: 'sync' })
}
