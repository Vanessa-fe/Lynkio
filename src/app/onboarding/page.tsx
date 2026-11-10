import { redirect } from 'next/navigation'
import { getUserProfile } from '@/lib/queries/user-profile'
import { getAuthUser } from '@/lib/supabase/auth'
import { getActiveProfessions } from '@/lib/queries/professions'
import { THEMES } from '@/lib/constants/themes'
import { OnboardingForm } from '@/components/onboarding/onboarding-form'
import { PostHogIdentify } from '@/components/analytics/posthog-identify'

export default async function OnboardingPage() {
  const [profile, professions, user] = await Promise.all([getUserProfile(), getActiveProfessions(), getAuthUser()])

  if (!profile) {
    redirect('/login')
  }

  if (profile.onboarding_completed && profile.profession_key) {
    redirect('/dashboard')
  }

  const hasValidTheme = THEMES.some((theme) => theme.id === profile.selected_theme)
  // Tant qu'un seul métier est ouvert, il est présélectionné
  const onlyProfessionKey = professions.length === 1 ? professions[0]?.key : undefined

  return (
    <>
      <PostHogIdentify userId={profile.id} email={user?.email ?? null} professionKey={profile.profession_key} />
      <OnboardingForm
        professions={professions.map(({ key, label, description, suggested_keywords, default_icp }) => {
          const defaults = (default_icp as { search_keywords?: unknown } | null)?.search_keywords
          return {
            key,
            label,
            description,
            suggestedKeywords: suggested_keywords,
            defaultKeywords: Array.isArray(defaults) ? defaults.filter((k): k is string => typeof k === 'string') : [],
          }
        })}
        defaultValues={{
          firstName: profile.first_name ?? undefined,
          businessName: profile.business_name ?? undefined,
          professionKey: profile.profession_key ?? onlyProfessionKey,
          selectedTheme: hasValidTheme && profile.selected_theme ? profile.selected_theme : undefined,
        }}
        isReturningUser={profile.onboarding_completed === true}
        email={user?.email ?? null}
      />
    </>
  )
}
