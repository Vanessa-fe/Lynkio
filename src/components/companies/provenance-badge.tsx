import { Bot, Landmark, Lightbulb, User } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * D'où vient une information (décision du 17/11/2026) : sources officielles, analyse par l'IA de
 * l'utilisateur, hypothèse (ce que Filonéa ou Sophie suppose), ou saisie de l'utilisateur.
 */
export type ProvenanceKind = 'official' | 'ai' | 'hypothesis' | 'user'

const STYLES: Record<ProvenanceKind, { label: string; icon: typeof Bot; className: string }> = {
  official: {
    label: 'Source officielle',
    icon: Landmark,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  ai: {
    label: 'Analyse IA',
    icon: Bot,
    className: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
  },
  hypothesis: {
    label: 'Hypothèse',
    icon: Lightbulb,
    className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  },
  user: {
    label: 'Ajoutée par vous',
    icon: User,
    className: 'border-border bg-muted text-muted-foreground',
  },
}

export function ProvenanceBadge({
  kind,
  detail,
  className,
}: {
  kind: ProvenanceKind
  // Précision après le libellé : « registre des entreprises », « import CSV »…
  detail?: string | null
  className?: string
}) {
  const style = STYLES[kind]
  const Icon = style.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium align-middle',
        style.className,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {style.label}
      {detail && <span className="font-normal opacity-80">· {detail}</span>}
    </span>
  )
}

/** Provenance d'une entreprise d'après companies.origin et companies.discovered_by */
export function companyProvenance(company: { origin: string; discovered_by: string | null }): {
  kind: ProvenanceKind
  detail: string | null
} | null {
  switch (company.discovered_by) {
    case 'registry':
      return { kind: 'official', detail: 'registre des entreprises' }
    case 'bodacc':
      return { kind: 'official', detail: 'créations récentes (BODACC)' }
    case 'job_postings':
      return { kind: 'official', detail: 'offre d’emploi' }
    case 'tech_ai':
      return { kind: 'ai', detail: 'recherche par technologie' }
  }
  if (company.origin === 'import') return { kind: 'user', detail: 'import CSV' }
  if (company.origin === 'manual') return { kind: 'user', detail: null }
  // Source non enregistrée : on ne suppose rien, aucun badge
  return null
}
