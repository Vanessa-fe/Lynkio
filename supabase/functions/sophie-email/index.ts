// Envoi par e-mail des alertes et bilans de Sophie (API transactionnelle de Brevo).
// Appelée chaque heure par pg_cron (sophie-emails), ou à la main pour un test.
// Sans jeton : elle n'envoie que les alertes en attente, une seule fois chacune
// (réservées par claim_sophie_emails), donc un appel en trop n'envoie rien de plus.
import { createClient } from '@supabase/supabase-js'

type Row = {
  id: string; user_id: string; kind: 'signal' | 'digest'; title: string; source: string
  source_url: string | null; event_at: string | null; period_start: string | null; period_end: string | null
  counts: { outgoing: number; incoming: number; meetings: number; notes: number } | null
}

const APP_URL = 'https://filonea.fr'
const SENDER = Deno.env.get('BREVO_FROM_EMAIL') || 'contact@filonea.fr'
const SOURCES: Record<string, string> = {
  bodacc: 'BODACC (annonces légales)', site: 'site web de l’entreprise', registry: 'registre officiel des entreprises',
  france_travail: 'France Travail', linkedin: 'LinkedIn', ai_research: 'recherche de votre IA', manual: 'ajouté à la main',
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const day = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date(iso))
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/** Une ligne par alerte : le titre, la source et la date de l'événement */
function line(row: Row): string {
  if (row.kind === 'digest') {
    const c = row.counts ?? { outgoing: 0, incoming: 0, meetings: 0, notes: 0 }
    // La semaine s'arrête le lundi à 0 h (exclu) : on affiche le dimanche
    const end = row.period_end ? day(new Date(new Date(row.period_end).getTime() - 1).toISOString()) : '?'
    return `Bilan du ${row.period_start ? day(row.period_start) : '?'} au ${end} : ` + [
      plural(c.outgoing, 'prise de contact envoyée', 'prises de contact envoyées'),
      plural(c.incoming, 'réponse reçue', 'réponses reçues'),
      plural(c.meetings, 'rendez-vous', 'rendez-vous'),
      plural(c.notes, 'note', 'notes'),
    ].join(', ')
  }
  const details = [`source : ${SOURCES[row.source] ?? 'source inconnue'}`]
  if (row.event_at) details.push(`événement du ${day(row.event_at)}`)
  return `${row.title} (${details.join(', ')})`
}

function subject(rows: Row[]): string {
  const signals = rows.filter((r) => r.kind === 'signal').length
  const digest = rows.some((r) => r.kind === 'digest')
  if (signals === 0) return 'Votre bilan hebdomadaire de Sophie'
  const text = `Sophie : ${plural(signals, 'nouveau signal', 'nouveaux signaux')}`
  return digest ? `${text} et votre bilan de la semaine` : text
}

async function send(apiKey: string, to: string, all: Row[]): Promise<boolean> {
  const link = `${APP_URL}/notifications`
  const rows = all.slice(0, 30)
  const more = all.length - rows.length
  const textContent = [
    'Bonjour,', 'Voici les nouveautés repérées par Sophie :',
    ...rows.map((r) => `- ${line(r)}`),
    ...(more > 0 ? [`… et ${plural(more, 'autre alerte', 'autres alertes')}.`] : []),
    `Tout voir dans Filonéa : ${link}`,
    `Vous recevez cet e-mail car vous avez activé les alertes de Sophie. Pour ne plus les recevoir par e-mail, décochez la case sur ${link}`,
  ].join('\n\n')
  const htmlContent = `<p>Bonjour,</p><p>Voici les nouveautés repérées par Sophie :</p><ul>${rows.map((r) =>
    `<li>${escape(line(r))}${r.source_url ? ` · <a href="${escape(r.source_url)}">voir la source</a>` : ''}</li>`).join('')}</ul>
${more > 0 ? `<p>… et ${plural(more, 'autre alerte', 'autres alertes')}.</p>` : ''}
<p><a href="${link}">Tout voir dans Filonéa</a></p>
<p style="color:#666;font-size:12px">Vous recevez cet e-mail car vous avez activé les alertes de Sophie.
Pour ne plus les recevoir par e-mail, décochez la case sur <a href="${link}">la page Alertes</a>.</p>`
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Sophie de Filonéa', email: SENDER }, to: [{ email: to }], subject: subject(all), textContent, htmlContent }),
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
