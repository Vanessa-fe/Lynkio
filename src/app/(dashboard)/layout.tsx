import { getUserProfile } from '@/lib/queries/user-profile'
import { getAuthUser } from '@/lib/supabase/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { PostHogIdentify } from '@/components/analytics/posthog-identify'
import { NavigationProgress } from '@/components/layout/navigation-progress'
import { BillingBanner } from '@/components/billing/billing-banner'
import { getBilling } from '@/lib/queries/billing'
import { getAccess } from '@/lib/billing'
import { RunCompletionDialog } from '@/components/prospection/run-completion-dialog'
import { SophieProvider } from '@/components/sophie/sophie-provider'
import { SophieLauncher, SophieMain, SophiePanel } from '@/components/sophie/sophie-panel'
import { getMyApiKeys } from '@/lib/queries/api-keys'
import { AI_PROVIDER_LABELS, isAiProvider } from '@/lib/constants/api-keys'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [profile, user, billing, keys] = await Promise.all([getUserProfile(), getAuthUser(), getBilling(), getMyApiKeys()])

  if (!profile) {
    redirect('/login')
  }

  // Les comptes créés avant le choix du métier repassent par l'onboarding
  if (!profile.onboarding_completed || !profile.profession_key) {
    redirect('/onboarding')
  }

  // Essai terminé sans abonnement : seule la page Abonnement reste ouverte (avec l'export et la suppression)
  const access = getAccess(billing)
  if (!access.allowed) {
    redirect('/billing')
  }

  // IA de Sophie : celle choisie dans Paramètres > Vos clés, sinon la première clé d'IA enregistrée
  const aiProviders = keys.map((key) => key.provider).filter(isAiProvider)
  const sophieProvider =
    profile.ai_provider && isAiProvider(profile.ai_provider) && aiProviders.includes(profile.ai_provider)
      ? profile.ai_provider
      : (aiProviders[0] ?? null)

  return (
    <SophieProvider
      hasAiKey={sophieProvider !== null}
      providerLabel={sophieProvider ? AI_PROVIDER_LABELS[sophieProvider] : null}
      firstName={profile.first_name}
      autoOpen={profile.sophie_auto_open}
    >
      <div className="min-h-screen bg-background">
        <NavigationProgress />
        <PostHogIdentify userId={profile.id} email={user?.email ?? null} professionKey={profile.profession_key} />
        <Sidebar />
        <SophieMain>
          <main className="mx-auto max-w-7xl p-4 pb-24 md:p-8 md:pb-10">
            <BillingBanner access={access} />
            {children}
          </main>
        </SophieMain>
        <MobileNav />
        <RunCompletionDialog />
        <SophieLauncher />
        <SophiePanel />
      </div>
    </SophieProvider>
  )
}
