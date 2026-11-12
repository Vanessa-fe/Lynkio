'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

export async function savePreferences(_: string, form: FormData) {
  const frequency = form.get('frequency')
  if (frequency !== 'off' && frequency !== 'daily' && frequency !== 'weekly') return 'Fréquence invalide.'
  if (!(await getAuthUser())) return 'Reconnectez-vous pour enregistrer vos préférences.'
  const client = await createClient()
  const { error } = await client.rpc('set_sophie_preferences', {
    p_frequency: frequency, p_digest: form.get('digest') === 'on',
  })
  if (error) return 'Enregistrement impossible. Réessayez.'
  revalidatePath('/notifications')
  revalidatePath('/dashboard')
  return 'Préférences enregistrées.'
}

export async function markNotificationsRead() {
  const user = await getAuthUser()
  if (!user) throw new Error('Connexion requise')
  const client = await createClient()
  const { error } = await client.from('sophie_notifications').update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id).is('read_at', null)
  if (error) throw new Error('Impossible de marquer les notifications comme lues.')
  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}
