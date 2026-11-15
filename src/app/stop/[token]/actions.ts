'use server'

import { createClient } from '@/lib/supabase/server'

/** Enregistre l'opposition liée au jeton (fonction opt_out_by_token, ouverte sans compte) */
export async function confirmOptOut(_: unknown, form: FormData): Promise<'done' | 'invalid' | 'error'> {
  const token = form.get('token')
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return 'invalid'
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('opt_out_by_token', { p_token: token })
  if (error) return 'error'
  return data === 'done' ? 'done' : 'invalid'
}
