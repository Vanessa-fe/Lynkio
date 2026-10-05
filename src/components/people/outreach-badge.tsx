import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { outreachStatusLabels, outreachStatusTones } from '@/lib/constants/outreach'
import { cn } from '@/lib/utils'
import type { OutreachStatus } from '@/types'

interface OutreachBadgeProps {
  status: OutreachStatus
  lastSentAt?: string | null
  lastReplyAt?: string | null
  // Ligne « envoyé il y a 3 jours » sous le badge
  showWhen?: boolean
}

/**
 * Statut de prospection d'une personne, avec la date du dernier envoi ou de la réponse
 */
export function OutreachBadge({ status, lastSentAt, lastReplyAt, showWhen = false }: OutreachBadgeProps) {
  const when = status === 'replied' ? lastReplyAt : status === 'to_contact' ? null : lastSentAt
  const label = status === 'replied' ? 'réponse' : 'envoi'

  return (
    <div className="space-y-0.5">
      <span
        className={cn(
          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
          outreachStatusTones[status]
        )}
      >
        {outreachStatusLabels[status]}
      </span>
      {showWhen && when && status !== 'do_not_contact' && (
        <p className="text-xs text-muted-foreground whitespace-nowrap">
          {label} {formatDistanceToNow(new Date(when), { addSuffix: true, locale: fr })}
        </p>
      )}
    </div>
  )
}
