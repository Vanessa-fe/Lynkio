import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/queries/user-profile'
import { getActiveProfessions } from '@/lib/queries/professions'
import { THEMES } from '@/lib/constants/themes'
import { OnboardingForm } from '@/components/onboarding/onboarding-form'

export default async function OnboardingPage() {
  const [profile, professions] = await Promise.all([getUserProfile(), getActiveProfessions()])

  if (!profile) {
    redirect('/login')
  }

  if (profile.onboarding_completed && profile.profession_key) {
    redirect('/dashboard')
  }

  const hasValidTheme = THEMES.some((theme) => theme.id === profile.selected_theme)

  return (
    <OnboardingForm
      professions={professions.map(({ key, label, description }) => ({ key, label, description }))}
      defaultValues={{
        firstName: profile.first_name ?? undefined,
        businessName: profile.business_name ?? undefined,
        professionKey: profile.profession_key ?? undefined,
        selectedTheme: hasValidTheme && profile.selected_theme ? profile.selected_theme : undefined,
      }}
      isReturningUser={profile.onboarding_completed === true}
    />
  )
}
