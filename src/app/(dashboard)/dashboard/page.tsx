import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/queries/user-profile'
import { getDashboardData } from '@/lib/queries/prospection-dashboard'
import { TodayReminders } from '@/components/dashboard/today-reminders'
import { TopOpportunities } from '@/components/dashboard/top-opportunities'
import { PipelineSummary } from '@/components/dashboard/pipeline-summary'
import { WelcomeBand } from '@/components/dashboard/welcome-band'
import { GoalsBarometer } from '@/components/dashboard/goals-barometer'
import { getGoalProgress } from '@/lib/queries/offer'
import { countUnreadNotifications } from '@/lib/queries/notifications'

/**
 * Tableau de bord (lot 1.5) : une seule question, « qu'est-ce que je peux faire aujourd'hui pour avancer ? ».
 * Dans l'ordre : l'accueil de Sophie et ses suggestions, les actions du jour, les nouvelles entreprises,
 * puis quelques indicateurs utiles (objectifs seulement s'ils sont fixés).
 */
export default async function DashboardPage() {
  const [profile, data, goals, unreadAlerts] = await Promise.all([
    getUserProfile(),
    getDashboardData(),
    getGoalProgress(),
    countUnreadNotifications(),
  ])

  if (!profile || !data) {
    redirect('/login')
  }

  const { goals: targets } = goals ?? { goals: null }
  const hasGoals = Boolean(targets && (targets.contactsPerWeek || targets.clientsPerMonth || targets.revenuePerMonth))

  return (
    <div className="space-y-6">
      <WelcomeBand firstName={profile.first_name} data={data} unreadAlerts={unreadAlerts} />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <TodayReminders reminders={data.todayReminders} />
        <TopOpportunities opportunities={data.opportunities} />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <PipelineSummary stats={data.stats} pipeline={data.pipeline} />
        {goals && hasGoals && <GoalsBarometer progress={goals} />}
      </div>
    </div>
  )
}
