import { ExtensionConnection } from '@/components/settings/extension-connection'
import { LinkedinPaceForm } from '@/components/settings/linkedin-pace-form'
import { LINKEDIN_INVITATIONS_PER_DAY, LINKEDIN_MESSAGES_PER_DAY } from '@/lib/linkedin-caps'
import { createClient } from '@/lib/supabase/server'

export default async function ExtensionSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Rythme d'envoi choisi (valeurs par défaut tant que rien n'est enregistré)
  const { data: pace } = user
    ? await supabase
        .from('linkedin_automation')
        .select('daily_invitations_limit, daily_messages_limit')
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null }

  return (
    <div className="space-y-6 max-w-4xl">

      <div>
        <h1 className="text-3xl font-bold">Extension LinkedIn</h1>
      </div>

      <ExtensionConnection accountEmail={user?.email ?? null} />

      <LinkedinPaceForm
        dailyInvitationsLimit={pace?.daily_invitations_limit ?? LINKEDIN_INVITATIONS_PER_DAY.default}
        dailyMessagesLimit={pace?.daily_messages_limit ?? LINKEDIN_MESSAGES_PER_DAY.default}
      />
    </div>
  )
}
