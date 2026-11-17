import Link from 'next/link'
import { AlertCircle, Building2, Sparkles, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Stagger, StaggerItem } from '@/components/motion/reveal'
import { Counter } from '@/components/motion/counter'
import { cn } from '@/lib/utils'
import type { DashboardData } from '@/lib/queries/prospection-dashboard'

function StatTile({
  href,
  icon,
  label,
  value,
  suffix,
  detail,
  alert,
}: {
  href: string
  icon: React.ReactNode
  label: string
  // Les nombres défilent jusqu'à leur valeur à l'affichage
  value: number | string
  suffix?: string
  detail: string
  alert?: boolean
}) {
  return (
    <Link href={href} className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-[box-shadow,transform] duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift">
        <CardContent className="p-4 sm:p-5 space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <span className={cn('flex size-7 items-center justify-center rounded-lg bg-secondary text-primary', alert && 'bg-destructive/10 text-destructive')}>
              {icon}
            </span>
            {label}
          </div>
          <p className={cn('font-display text-2xl sm:text-3xl font-bold tracking-tight tabular-nums', alert && 'text-destructive')}>
            {typeof value === 'number' ? <Counter to={value} suffix={suffix} duration={1.2} /> : value}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">{detail}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

/** « Dont 12 des sources officielles, 3 par analyse IA » : jamais attribuer à l'IA ce que le moteur classique a trouvé */
function foundDetail(found: number, byAi: number): string {
  if (found === 0) return 'Ajoutées ces 7 derniers jours'
  const official = found - byAi
  const parts = [
    official > 0 && `${official} des sources officielles`,
    byAi > 0 && `${byAi} par analyse IA`,
  ].filter(Boolean)
  return `Dont ${parts.join(', ')}`
}

export function ProspectionStats({ stats }: { stats: DashboardData['stats'] }) {
  // Taux de réussite masqué tant qu'aucune piste n'est signée ou non concrétisée : pas de tiret à expliquer
  const hasSuccessRate = stats.successRate !== null && stats.won + stats.lost > 0
  return (
    <Stagger
      className={cn('grid gap-3 sm:gap-4 grid-cols-2', hasSuccessRate ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}
      stagger={0.06}
    >
      <StaggerItem>
        <StatTile
          href="/companies?vue=kanban"
          icon={<Building2 className="w-4 h-4" />}
          label="Pistes en cours"
          value={stats.tracked}
          detail="Démarches commerciales ouvertes"
        />
      </StaggerItem>
      <StaggerItem>
        <StatTile
          href="/companies"
          icon={<Sparkles className="w-4 h-4" />}
          label="Nouvelles cette semaine"
          value={stats.addedThisWeek}
          detail={foundDetail(stats.addedBySophieThisWeek, stats.addedByAiThisWeek)}
        />
      </StaggerItem>
      <StaggerItem>
        <StatTile
          href="/reminders"
          icon={<AlertCircle className="w-4 h-4" />}
          label="Relances en retard"
          value={stats.overdueReminders}
          detail={stats.overdueReminders > 0 ? 'À traiter en priorité' : 'Rien en retard, bravo'}
          alert={stats.overdueReminders > 0}
        />
      </StaggerItem>
      {hasSuccessRate && (
        <StaggerItem>
          <StatTile
            href="/companies?vue=kanban"
            icon={<Trophy className="w-4 h-4" />}
            label="Taux de réussite"
            value={stats.successRate ?? 0}
            suffix=" %"
            detail={`${stats.won} signée${stats.won > 1 ? 's' : ''}, ${stats.lost} non concrétisée${stats.lost > 1 ? 's' : ''}`}
          />
        </StaggerItem>
      )}
    </Stagger>
  )
}
