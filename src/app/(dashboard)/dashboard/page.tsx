import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/queries/user-profile'
import { getDashboardData } from '@/lib/queries/prospection-dashboard'
import { ProspectionStats } from '@/components/dashboard/prospection-stats'
import { TodayReminders } from '@/components/dashboard/today-reminders'
import { TopOpportunities } from '@/components/dashboard/top-opportunities'
import { PipelineOverview } from '@/components/dashboard/pipeline-overview'
import { SophieCard } from '@/components/dashboard/sophie-card'
import { WelcomeBand } from '@/components/dashboard/welcome-band'
import { GoalsBarometer } from '@/components/dashboard/goals-barometer'
import { getGoalProgress } from '@/lib/queries/offer'
import { countUnreadNotifications } from '@/lib/queries/notifications'

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

  return (
    <div className="space-y-6">
      <WelcomeBand firstName={profile.first_name} data={data} unreadAlerts={unreadAlerts} />

      <ProspectionStats stats={data.stats} />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {goals && <GoalsBarometer progress={goals} />}
        <TodayReminders reminders={data.todayReminders} />
        <TopOpportunities opportunities={data.opportunities} />
        <PipelineOverview pipeline={data.pipeline} />
        <SophieCard lastRun={data.lastRun} unidentifiedOffers={data.unidentifiedOffers} nextRunAt={data.nextRunAt} />
      </div>
    </div>
  )
}
