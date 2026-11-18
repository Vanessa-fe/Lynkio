import { MessageSettingsForm } from '@/components/settings/message-settings-form'
import { getUserProfile } from '@/lib/queries/user-profile'

export default async function MessageSettingsPage() {
  const profile = await getUserProfile()

  return (
    <div className="space-y-6 max-w-4xl">

      <div>
        <h1 className="text-3xl font-bold">Messages de Sophie</h1>
      </div>

      <MessageSettingsForm pitch={profile?.message_pitch ?? null} signature={profile?.message_signature ?? null} />
    </div>
  )
}
