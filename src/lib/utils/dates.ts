import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// Fuseau affiché dans l'application. Les pages sont préparées sur un serveur
// réglé en UTC (Netlify) : sans conversion, 9 h à Paris s'afficherait « 7 h ».
export const APP_TIME_ZONE = 'Europe/Paris'

/**
 * Date dont l'heure locale est celle de Paris, quel que soit le fuseau de la
 * machine (serveur en UTC ou navigateur) : date-fns formate l'heure locale.
 */
function inAppTimeZone(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0)

  return new Date(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'))
}

/**
 * Formate une date à l'heure de Paris, en français (motifs date-fns)
 */
export function formatDate(value: Date | string, pattern: string): string {
  return format(inAppTimeZone(new Date(value)), pattern, { locale: fr })
}

/**
 * Même jour calendaire à Paris
 */
export function isSameParisDay(a: Date | string, b: Date | string): boolean {
  return formatDate(a, 'yyyy-MM-dd') === formatDate(b, 'yyyy-MM-dd')
}
