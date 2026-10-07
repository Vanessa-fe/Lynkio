import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/queries/user-profile'
import { getDashboardData } from '@/lib/queries/prospection-dashboard'
import { ProspectionStats } from '@/components/dashboard/prospection-stats'
import { TodayReminders } from '@/components/dashboard/today-reminders'
import { TopOpportunities } from '@/components/dashboard/top-opportunities'
import { PipelineOverview } from '@/components/dashboard/pipeline-overview'
import { SophieCard } from '@/components/dashboard/sophie-card'

export default async function DashboardPage() {
  const [profile, data] = await Promise.all([getUserProfile(), getDashboardData()])

  if (!profile || !data) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold md:text-4xl">
          Bonjour{profile.first_name ? ' ' : ''}
          {profile.first_name && <span className="accent-serif text-primary">{profile.first_name}</span>}
        </h1>
        <p className="text-muted-foreground mt-2">Où en est votre prospection</p>
      </div>

      <ProspectionStats stats={data.stats} />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <TodayReminders reminders={data.todayReminders} />
        <TopOpportunities opportunities={data.opportunities} />
        <PipelineOverview pipeline={data.pipeline} />
        <SophieCard lastRun={data.lastRun} unidentifiedOffers={data.unidentifiedOffers} nextRunAt={data.nextRunAt} />
      </div>
    </div>
  )
}
