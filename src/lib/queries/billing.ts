import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import type { Billing } from '@/types/models'

/** Abonnement du compte connecté (essai, offre, statut Stripe), partagé entre les requêtes d'un affichage */
export const getBilling = cache(async (): Promise<Billing | null> => {
  const user = await getAuthUser()
  if (!user) return null
  const supabase = await createClient()
  const { data, error } = await supabase.from('billing').select('*').eq('user_id', user.id).maybeSingle()
  if (error) return null
  return data
})
