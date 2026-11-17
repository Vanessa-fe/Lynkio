import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils/dates'
import type { DashboardData } from '@/lib/queries/prospection-dashboard'

type Message = { headline: string; detail: string; href: string; action: string }

function plural(count: number, word: string) {
  return `${count} ${word}${count > 1 ? 's' : ''}`
}

/**
 * Le message du jour suit ce qui compte le plus maintenant : d'abord les relances
 * en retard, puis celles du jour, puis les nouvelles pistes de Sophie
 */
function messageFor(data: DashboardData): Message {
  const { overdueReminders, addedBySophieThisWeek, addedThisWeek } = data.stats
  if (overdueReminders > 0) {
    return {
      headline: 'Quelques relances vous attendent.',
      detail: `${plural(overdueReminders, 'relance')} en retard : c'est le bon moment pour reprendre contact.`,
      href: '/reminders',
      action: 'Voir mes relances',
    }
  }
  if (data.todayReminders.length > 0) {
    return {
      headline: 'Une belle journée pour faire avancer vos pistes.',
      detail: `${plural(data.todayReminders.length, 'relance')} prévue${data.todayReminders.length > 1 ? 's' : ''} aujourd'hui.`,
      href: '/reminders',
      action: 'Voir mes relances',
    }
  }
  if (addedBySophieThisWeek > 0) {
    return {
      headline: 'Votre prochaine belle opportunité est peut-être ici.',
      detail: `Sophie a repéré ${plural(addedBySophieThisWeek, 'entreprise')} à découvrir cette semaine.`,
      href: '/companies',
      action: 'Voir les nouvelles pistes',
    }
  }
  if (addedThisWeek > 0) {
    return {
      headline: 'Votre prochaine belle opportunité est peut-être ici.',
      detail: `${plural(addedThisWeek, 'nouvelle entreprise')} ajoutée${addedThisWeek > 1 ? 's' : ''} cette semaine.`,
      href: '/companies',
      action: 'Voir les entreprises',
    }
  }
  return {
    headline: 'Votre prochain client commence par une bonne conversation.',
    detail: 'Décrivez à Sophie les entreprises que vous aimeriez rencontrer, elle les cherche pour vous.',
    href: '/prospection',
    action: 'Aller à la prospection',
  }
}

/** Bandeau d'accueil du tableau de bord : un bonjour, et la chose à faire maintenant */
export function WelcomeBand({
  firstName,
  data,
  unreadAlerts,
}: {
  firstName: string | null
  data: DashboardData
  unreadAlerts: number
}) {
  const message = messageFor(data)

  return (
    <section className="overflow-hidden rounded-3xl bg-wine px-6 py-7 text-cream shadow-lift sm:px-8 sm:py-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="accent-serif text-3xl text-cream md:text-4xl">
            Bonjour{firstName ? ` ${firstName}` : ''},
          </h1>
          <p className="font-display text-xl font-semibold tracking-tight md:text-2xl">{message.headline}</p>
          <p className="text-sm text-cream/75 md:text-base">{message.detail}</p>
        </div>
        <Button asChild size="lg" className="group shrink-0 self-start lg:self-center">
          <Link href={message.href}>
            {message.action}
            <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-cream/15 pt-4 text-sm text-cream/75">
        {data.nextRunAt && (
          <span className="inline-flex items-center gap-2">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-peach opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-peach" />
            </span>
            Sophie travaille pour vous · prochaine recherche le{' '}
            {formatDate(new Date(data.nextRunAt), "EEEE d MMMM 'à' H'h'")}
          </span>
        )}
        <Link href="/results" className="underline-offset-2 hover:text-cream hover:underline">
          Vos résultats étape par étape
        </Link>
        <Link href="/notifications" className="underline-offset-2 hover:text-cream hover:underline">
          {unreadAlerts > 0
            ? `${unreadAlerts} nouvelle${unreadAlerts > 1 ? 's' : ''} alerte${unreadAlerts > 1 ? 's' : ''} de Sophie`
            : 'Alertes de Sophie'}
        </Link>
      </div>
    </section>
  )
}
