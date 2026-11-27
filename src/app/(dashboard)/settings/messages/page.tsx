import { MessageSettingsForm } from '@/components/settings/message-settings-form'
import { getUserProfile } from '@/lib/queries/user-profile'
import { getCurrentPlan } from '@/lib/queries/billing'
import { WHATSAPP_DEFAULT_DAILY_LIMIT } from '@/lib/whatsapp'

export default async function MessageSettingsPage() {
  const [profile, plan] = await Promise.all([getUserProfile(), getCurrentPlan()])

  return (
    <div className="space-y-6 max-w-4xl">

      <div>
        <h1 className="text-3xl font-bold">Messages de Sophie</h1>
      </div>

      <MessageSettingsForm
        pitch={profile?.message_pitch ?? null}
        signature={profile?.message_signature ?? null}
        // WhatsApp : offre Pro seulement
        whatsappDailyLimit={plan === 'pro' ? (profile?.whatsapp_daily_limit ?? WHATSAPP_DEFAULT_DAILY_LIMIT) : null}
      />
    </div>
  )
}
