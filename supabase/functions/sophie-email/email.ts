// Mise en page de l'e-mail des alertes et bilans de Sophie : mêmes couleurs, logo et carte que les
// e-mails de connexion (supabase/templates/confirmation.html). Sans dépendance ni réseau : testé dans
// src/lib/__checks__/sophie-email.check.ts.
//
// Règles des e-mails : tableaux et styles en ligne (les messageries ignorent le CSS des feuilles),
// largeur 520 px, police Arial, chaque texte venu de la base échappé, liens seulement en http(s).

export type AlertRow = {
  id: string
  user_id: string
  kind: 'signal' | 'digest'
  title: string
  source: string
  source_url: string | null
  event_at: string | null
  period_start: string | null
  period_end: string | null
  counts: { outgoing: number; incoming: number; meetings: number; notes: number } | null
}

export const APP_URL = 'https://filonea.fr'
export const MAX_ALERTS = 30

const COLORS = {
  page: '#fdfaf7',
  card: '#ffffff',
  border: '#ebe0db',
  title: '#241614',
  text: '#4a3a36',
  muted: '#6d5a55',
  faint: '#9a8a85',
  accent: '#c9432f',
  soft: '#f8efeb',
}
const FONT = 'Arial,Helvetica,sans-serif'

const SOURCES: Record<string, string> = {
  bodacc: 'BODACC (annonces légales)',
  site: 'site web de l’entreprise',
  registry: 'registre officiel des entreprises',
  linkedin: 'LinkedIn',
  ai_research: 'analyse approfondie de votre IA',
  manual: 'ajouté à la main',
}

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const day = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date(iso))

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/** Lien d'une source : seulement une adresse http(s), sinon aucun lien */
export function safeLink(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function sourceLabel(row: AlertRow): string {
  return SOURCES[row.source] ?? 'source inconnue'
}

/** Période d'un bilan : la semaine s'arrête le lundi à 0 h (exclu), on affiche donc le dimanche */
function period(row: AlertRow): string {
  const start = row.period_start ? day(row.period_start) : '?'
  const end = row.period_end ? day(new Date(new Date(row.period_end).getTime() - 1).toISOString()) : '?'
  return `du ${start} au ${end}`
}

function counts(row: AlertRow) {
  return row.counts ?? { outgoing: 0, incoming: 0, meetings: 0, notes: 0 }
}

/** Ligne texte d'une alerte (version texte de l'e-mail) */
export function textLine(row: AlertRow): string {
  if (row.kind === 'digest') {
    const c = counts(row)
    return `Bilan ${period(row)} : ` + [
      plural(c.outgoing, 'prise de contact envoyée', 'prises de contact envoyées'),
      plural(c.incoming, 'réponse reçue', 'réponses reçues'),
      plural(c.meetings, 'rendez-vous', 'rendez-vous'),
      plural(c.notes, 'note', 'notes'),
    ].join(', ')
  }
  const details = [`source : ${sourceLabel(row)}`]
  if (row.event_at) details.push(`événement du ${day(row.event_at)}`)
  const link = safeLink(row.source_url)
  return `${row.title} (${details.join(', ')})${link ? ` : ${link}` : ''}`
}

export function emailSubject(rows: AlertRow[]): string {
  const signals = rows.filter((r) => r.kind === 'signal').length
  const digest = rows.some((r) => r.kind === 'digest')
  if (signals === 0) return 'Votre bilan hebdomadaire de Sophie'
  const text = `Sophie : ${plural(signals, 'nouveau signal', 'nouveaux signaux')}`
  return digest ? `${text} et votre bilan de la semaine` : text
}

/** « Entreprise créée récemment · MAISON GENIN » → l'entreprise d'abord, puis le type de signal */
export function splitTitle(title: string): { company: string; signal: string | null } {
  const index = title.lastIndexOf(' · ')
  if (index <= 0) return { company: title, signal: null }
  return { company: title.slice(index + 3).trim() || title, signal: title.slice(0, index).trim() || null }
}

function signalBlock(row: AlertRow): string {
  const link = safeLink(row.source_url)
  const { company, signal } = splitTitle(row.title)
  const meta = [sourceLabel(row), row.event_at ? `événement du ${day(row.event_at)}` : null].filter(Boolean).join(' · ')
  return `<tr><td style="padding:14px 16px;background-color:${COLORS.soft};border-radius:12px;font-family:${FONT};">
<div style="font-size:15px;line-height:1.45;font-weight:bold;color:${COLORS.title};">${escapeHtml(company)}</div>
${signal ? `<div style="padding-top:2px;font-size:14px;line-height:1.45;color:${COLORS.text};">${escapeHtml(signal)}</div>` : ''}
<div style="padding-top:4px;font-size:13px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(meta)}${
    link ? ` · <a href="${escapeHtml(link)}" style="color:${COLORS.accent};text-decoration:underline;">Voir la source</a>` : ''
  }</div>
</td></tr>
<tr><td style="height:10px;line-height:10px;font-size:10px;">&nbsp;</td></tr>`
}

function statCell(value: number, label: string): string {
  return `<td width="25%" align="center" valign="top" style="padding:12px 4px;background-color:${COLORS.soft};border-radius:12px;font-family:${FONT};">
<div style="font-size:22px;line-height:1.2;font-weight:bold;color:${COLORS.title};">${value}</div>
<div style="padding-top:2px;font-size:12px;line-height:1.35;color:${COLORS.muted};">${label}</div>
</td>`
}

function digestBlock(row: AlertRow): string {
  const c = counts(row)
  const gap = '<td width="8" style="width:8px;">&nbsp;</td>'
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:${COLORS.muted};">Votre semaine ${escapeHtml(period(row))}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr>
${statCell(c.outgoing, c.outgoing > 1 ? 'prises de contact' : 'prise de contact')}${gap}
${statCell(c.incoming, c.incoming > 1 ? 'réponses reçues' : 'réponse reçue')}${gap}
${statCell(c.meetings, 'rendez-vous')}${gap}
${statCell(c.notes, c.notes > 1 ? 'notes' : 'note')}
</tr></table>`
}

function sectionTitle(text: string): string {
  return `<h2 style="margin:24px 0 12px;font-family:${FONT};font-size:17px;line-height:1.3;color:${COLORS.title};">${text}</h2>`
}

/** E-mail complet (objet, texte, HTML) pour les alertes d'un utilisateur */
export function renderAlertEmail(all: AlertRow[]): { subject: string; text: string; html: string } {
  const link = `${APP_URL}/notifications`
  const rows = all.slice(0, MAX_ALERTS)
  const more = all.length - rows.length
  const signals = rows.filter((r) => r.kind === 'signal')
  const digests = rows.filter((r) => r.kind === 'digest')
  const subject = emailSubject(all)

  const intro =
    signals.length > 0
      ? `Sophie a repéré ${plural(signals.length, 'nouveau signal', 'nouveaux signaux')} chez des entreprises qui correspondent à votre client idéal.`
      : 'Voici votre bilan de la semaine.'
  const preheader =
    signals.length > 0 ? `${plural(signals.length, 'nouveau signal', 'nouveaux signaux')} à regarder dans Filonea.` : 'Votre semaine de prospection en chiffres.'

  const text = [
    'Bonjour,',
    intro,
    ...rows.map((r) => `- ${textLine(r)}`),
    ...(more > 0 ? [`… et ${plural(more, 'autre alerte', 'autres alertes')}.`] : []),
    `Tout voir dans Filonea : ${link}`,
    `Vous recevez cet e-mail car vous avez activé les alertes de Sophie. Pour ne plus les recevoir par e-mail, décochez la case sur ${link}`,
  ].join('\n\n')

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.page};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 4px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="32" height="32" align="center" valign="middle" style="width:32px;height:32px;background-color:${COLORS.accent};border-radius:9px;color:${COLORS.page};font-family:${FONT};font-size:18px;font-weight:bold;line-height:32px;">F</td>
<td style="padding-left:10px;font-family:${FONT};font-size:20px;font-weight:bold;color:${COLORS.title};letter-spacing:-0.5px;">filonea</td>
</tr></table>
</td></tr>
<tr><td style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:20px;padding:36px 32px;font-family:${FONT};color:${COLORS.title};">
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:${COLORS.title};">Bonjour,</h1>
<p style="margin:0;font-size:16px;line-height:1.6;color:${COLORS.text};">${escapeHtml(intro)}</p>
${signals.length > 0 ? `${sectionTitle('Nouveaux signaux')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${signals.map(signalBlock).join('\n')}
</table>` : ''}
${digests.length > 0 ? `${sectionTitle('Votre bilan de la semaine')}${digests.map(digestBlock).join('\n')}` : ''}
${more > 0 ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:${COLORS.muted};">… et ${plural(more, 'autre alerte', 'autres alertes')} dans Filonea.</p>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
<tr><td align="center" style="background-color:${COLORS.accent};border-radius:999px;">
<a href="${link}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">Tout voir dans Filonea</a>
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${COLORS.muted};">Un signal est un fait public, pas un besoin confirmé : ouvrez la fiche pour voir la piste que Sophie vous propose.</p>
</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.faint};">
Vous recevez cet e-mail car vous avez activé les alertes de Sophie. Pour ne plus les recevoir par e-mail, décochez la case sur <a href="${link}" style="color:${COLORS.faint};text-decoration:underline;">la page Alertes</a>.<br>
Filonea · L’outil de prospection des freelances
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  return { subject, text, html }
}
