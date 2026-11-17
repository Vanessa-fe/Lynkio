import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils/dates'
import { dashboardWelcome } from '@/lib/dashboard-suggestions'
import type { DashboardData } from '@/lib/queries/prospection-dashboard'

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/**
 * Accueil de Sophie (lot 1.5) : bonjour, ce qui compte aujourd'hui d'après les chiffres réels, et au plus
 * trois suggestions issues de règles (pas d'IA). Rien à signaler : une phrase, sans bouton artificiel.
 */
export function WelcomeBand({
  firstName,
  data,
  unreadAlerts,
}: {
  firstName: string | null
  data: DashboardData
  unreadAlerts: number
}) {
  const { stats, todayReminders, lastRun, nextRunAt } = data
  const welcome = dashboardWelcome({
    overdueReminders: stats.overdueReminders,
    todayReminders: Math.max(0, todayReminders.length - stats.overdueReminders),
    newDiscoveries: stats.newDiscoveriesThisWeek,
    unreadAlerts,
    lastRunFailed: lastRun?.status === 'failed',
  })

  return (
    <section className="overflow-hidden rounded-3xl bg-wine px-6 py-7 text-cream shadow-lift sm:px-8 sm:py-8">
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cream/60">Sophie</p>
        <h1 className="accent-serif text-3xl text-cream md:text-4xl">Bonjour{firstName ? ` ${firstName}` : ''},</h1>
        <p className="font-display text-xl font-semibold tracking-tight md:text-2xl">{welcome.summary}</p>
      </div>

      {welcome.suggestions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {welcome.suggestions.map((suggestion, index) => (
            <Button
              key={suggestion.key}
              asChild
              size={index === 0 ? 'lg' : 'default'}
              variant={index === 0 ? 'default' : 'outline'}
              // Texte long sur mobile : le bouton passe à la ligne au lieu de déborder du bandeau
              className={cn(
                'group h-auto min-h-10 max-w-full whitespace-normal py-2 text-left',
                index === 0
                  ? 'px-5 sm:px-8'
                  : 'border-cream/30 bg-transparent text-cream hover:border-cream/60 hover:bg-cream/10 hover:text-cream'
              )}
            >
              <Link href={suggestion.href}>
                {suggestion.label}
                <ArrowRight className="ml-2 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </Button>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-cream/15 pt-4 text-sm text-cream/75">
        {nextRunAt ? (
          <span className="inline-flex items-center gap-2">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-peach opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-peach" />
            </span>
            Prochaine recherche le {formatDate(new Date(nextRunAt), "EEEE d MMMM 'à' H'h'")}
          </span>
        ) : (
          <Link href="/prospection" className="underline-offset-2 hover:text-cream hover:underline">
            Recherche automatique désactivée
          </Link>
        )}
        {lastRun?.status === 'succeeded' && lastRun.finished_at && (
          <span>
            Dernière recherche {formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true, locale: fr })} :{' '}
            {plural(lastRun.companies_created, 'entreprise ajoutée', 'entreprises ajoutées')}
          </span>
        )}
        <Link href="/results" className="underline-offset-2 hover:text-cream hover:underline">
          Vos résultats étape par étape
        </Link>
      </div>
    </section>
  )
}
