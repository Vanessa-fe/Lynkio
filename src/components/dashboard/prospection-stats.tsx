import Link from 'next/link'
import { AlertCircle, Building2, Sparkles, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DashboardData } from '@/lib/queries/prospection-dashboard'

function StatTile({
  href,
  icon,
  label,
  value,
  detail,
  alert,
}: {
  href: string
  icon: React.ReactNode
  label: string
  value: string
  detail: string
  alert?: boolean
}) {
  return (
    <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardContent className="p-4 sm:p-5 space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <span className={cn(alert && 'text-destructive')}>{icon}</span>
            {label}
          </div>
          <p className={cn('text-2xl sm:text-3xl font-bold tabular-nums', alert && 'text-destructive')}>{value}</p>
          <p className="text-xs sm:text-sm text-muted-foreground">{detail}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

export function ProspectionStats({ stats }: { stats: DashboardData['stats'] }) {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-4">
      <StatTile
        href="/companies"
        icon={<Building2 className="w-4 h-4" />}
        label="Pistes en cours"
        value={String(stats.tracked)}
        detail="Entreprises ni gagnées, ni perdues, ni hors cible"
      />
      <StatTile
        href="/companies"
        icon={<Sparkles className="w-4 h-4" />}
        label="Nouvelles cette semaine"
        value={String(stats.addedThisWeek)}
        detail={
          stats.addedBySophieThisWeek > 0
            ? `Dont ${stats.addedBySophieThisWeek} trouvée${stats.addedBySophieThisWeek > 1 ? 's' : ''} par Sophie`
            : 'Ajoutées ces 7 derniers jours'
        }
      />
      <StatTile
        href="/reminders"
        icon={<AlertCircle className="w-4 h-4" />}
        label="Relances en retard"
        value={String(stats.overdueReminders)}
        detail={stats.overdueReminders > 0 ? 'À traiter en priorité' : 'Rien en retard, bravo'}
        alert={stats.overdueReminders > 0}
      />
      <StatTile
        href="/companies"
        icon={<Trophy className="w-4 h-4" />}
        label="Taux de réussite"
        value={stats.successRate === null ? '–' : `${stats.successRate} %`}
        detail={
          stats.won + stats.lost === 0
            ? 'Calculé dès la première piste gagnée ou perdue'
            : `${stats.won} gagnée${stats.won > 1 ? 's' : ''}, ${stats.lost} perdue${stats.lost > 1 ? 's' : ''}`
        }
      />
    </div>
  )
}
