// Mise à jour de la fiche Brevo d'un compte depuis une fonction Supabase (abonnement payé ou résilié,
// première recherche réussie), pour les e-mails du cycle d'essai. Champs calculés en base
// (brevo_contact). Sans BREVO_API_KEY dans les secrets Supabase, rien n'est envoyé ; une erreur de Brevo
// est notée sans bloquer la fonction. Le champ OPT_IN n'est jamais envoyé ici : il n'est écrit qu'à
// l'inscription, et un désabonnement fait dans Brevo reste respecté.

import type { SupabaseClient } from '@supabase/supabase-js'

const SIGNUP_LIST_ID = 3

export async function syncBrevoContact(admin: SupabaseClient, userId: string): Promise<void> {
  const apiKey = Deno.env.get('BREVO_API_KEY')
  if (!apiKey) return
  try {
    const { data, error } = await admin.rpc('brevo_contact', { p_user_id: userId })
    if (error || !data) {
      if (error) console.error('brevo: fiche', error.message)
      return
    }
    const contact = data as { email: string; attributes: Record<string, unknown> }
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: contact.email,
        attributes: contact.attributes,
        listIds: [SIGNUP_LIST_ID],
        updateEnabled: true,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) console.error('brevo: envoi', response.status, (await response.text()).slice(0, 300))
  } catch (error) {
    console.error('brevo', error instanceof Error ? error.message : error)
  }
}
