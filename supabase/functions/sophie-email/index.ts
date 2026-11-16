// Envoi par e-mail des alertes et bilans de Sophie (API transactionnelle de Brevo).
// Appelée chaque heure par pg_cron (sophie-emails), ou à la main pour un test.
// Sans jeton : elle n'envoie que les alertes en attente, une seule fois chacune
// (réservées par claim_sophie_emails), donc un appel en trop n'envoie rien de plus.
import { createClient } from '@supabase/supabase-js'
import { renderAlertEmail, type AlertRow } from './email.ts'

const SENDER = Deno.env.get('BREVO_FROM_EMAIL') || 'contact@filonea.fr'

type Row = AlertRow

async function send(apiKey: string, to: string, all: Row[]): Promise<boolean> {
  // Mise en page (logo, carte, bouton) dans email.ts : mêmes couleurs que les e-mails de connexion
  const { subject, text, html } = renderAlertEmail(all)
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Sophie de Filonea', email: SENDER },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  })
  if (!response.ok) console.error('Brevo error:', response.status, await response.text())
  return response.ok
}

Deno.serve(async () => {
  const apiKey = Deno.env.get('BREVO_API_KEY')
  // Sans clé, rien n'est réservé : les alertes attendent que la clé soit ajoutée
  if (!apiKey) return Response.json({ error: 'BREVO_API_KEY manquante' }, { status: 500 })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await admin.rpc('claim_sophie_emails')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const byUser = new Map<string, Row[]>()
  for (const row of (data ?? []) as Row[]) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row])

  let sent = 0
  const failed: string[] = []
  for (const [userId, rows] of byUser) {
    const { data: { user } } = await admin.auth.admin.getUserById(userId)
    const ok = user?.email ? await send(apiKey, user.email, rows).catch(() => false) : false
    if (ok) sent++
    else failed.push(...rows.map((r) => r.id))
  }
  // Un e-mail qui n'est pas parti : ses alertes repartent à l'heure suivante (tant qu'elles ont moins de 2 jours)
  if (failed.length) await admin.rpc('release_sophie_emails', { p_ids: failed })
  return Response.json({ users: byUser.size, sent, failed: failed.length })
})
