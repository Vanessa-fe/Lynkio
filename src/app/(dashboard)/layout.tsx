import { getUserProfile } from '@/lib/queries/user-profile'
import { getAuthUser } from '@/lib/supabase/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { PostHogIdentify } from '@/components/analytics/posthog-identify'
import { NavigationProgress } from '@/components/layout/navigation-progress'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [profile, user] = await Promise.all([getUserProfile(), getAuthUser()])

  if (!profile) {
    redirect('/login')
  }

  // Les comptes créés avant le choix du métier repassent par l'onboarding
  if (!profile.onboarding_completed || !profile.profession_key) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationProgress />
      <PostHogIdentify userId={profile.id} email={user?.email ?? null} professionKey={profile.profession_key} />
      <Sidebar />
      <div className="md:pl-64">
        <main className="mx-auto max-w-7xl p-4 pb-24 md:p-8 md:pb-10">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
