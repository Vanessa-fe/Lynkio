/**
 * Conservation des données (RGPD) : durées proposées et libellés du journal d'accès.
 * Les valeurs doivent rester celles des contraintes CHECK de la migration 00061.
 */
import type { DataAccessAction, InactiveProspectMonths, LinkedinPostsRetentionDays } from '@/types/database'

export const INACTIVE_PROSPECT_MONTHS: { value: InactiveProspectMonths; label: string }[] = [
  { value: 6, label: '6 mois' },
  { value: 12, label: '1 an' },
  { value: 24, label: '2 ans' },
  { value: 36, label: '3 ans (recommandé par la CNIL)' },
]

export const LINKEDIN_POSTS_DAYS: { value: LinkedinPostsRetentionDays; label: string }[] = [
  { value: 7, label: '7 jours' },
  { value: 14, label: '14 jours' },
  { value: 30, label: '30 jours' },
  { value: 60, label: '60 jours' },
  { value: 90, label: '90 jours' },
]

export const DEFAULT_RETENTION = {
  inactive_prospect_months: 36 as InactiveProspectMonths,
  auto_purge_enabled: false,
  linkedin_posts_days: 30 as LinkedinPostsRetentionDays,
  last_purge_at: null as string | null,
}

export function isInactiveProspectMonths(value: number): value is InactiveProspectMonths {
  return INACTIVE_PROSPECT_MONTHS.some((option) => option.value === value)
}

export function isLinkedinPostsDays(value: number): value is LinkedinPostsRetentionDays {
  return LINKEDIN_POSTS_DAYS.some((option) => option.value === value)
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  gemini: 'Google Gemini',
  custom: 'IA personnalisée',
  hunter: 'Hunter',
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

function monthsLabel(months: unknown) {
  return INACTIVE_PROSPECT_MONTHS.find((option) => option.value === months)?.label.replace(/ \(.*\)$/, '') ?? `${months} mois`
}

/**
 * Phrase lisible pour une ligne du journal d'accès
 */
export function describeAccessLogEntry(action: DataAccessAction, details: Record<string, unknown>): string {
  const count = (key: string) => (typeof details[key] === 'number' ? (details[key] as number) : 0)
  const provider = PROVIDER_LABELS[String(details.provider ?? '')] ?? String(details.provider ?? 'un service')

  switch (action) {
    case 'export_companies':
      return `Export de vos entreprises (${plural(count('companies'), 'entreprise')})`
    case 'export_waalaxy':
      return `Export pour Waalaxy (${plural(count('contacts'), 'contact')})`
    case 'export_account':
      return 'Export complet de vos données'
    case 'api_key_saved':
      return `Clé ${provider} enregistrée`
    case 'api_key_deleted':
      return `Clé ${provider} supprimée`
    case 'retention_changed':
      return details.auto_purge_enabled
        ? `Conservation : nettoyage activé, prospects sans suite gardés ${monthsLabel(details.inactive_prospect_months)}`
        : 'Conservation : nettoyage automatique désactivé'
    case 'retention_purge': {
      const who = details.trigger === 'manual' ? 'Nettoyage lancé par vous' : 'Nettoyage automatique'
      return `${who} : ${plural(count('companies'), 'entreprise effacée', 'entreprises effacées')}, ${plural(count('contacts'), 'contact')}`
    }
  }
}
