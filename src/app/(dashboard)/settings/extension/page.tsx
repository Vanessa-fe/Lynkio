import { ExtensionConnection } from '@/components/settings/extension-connection'
import { createClient } from '@/lib/supabase/server'

export default async function ExtensionSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="space-y-6 max-w-4xl">

      <div>
        <h1 className="text-3xl font-bold">Extension LinkedIn</h1>
      </div>

      <ExtensionConnection accountEmail={user?.email ?? null} />
    </div>
  )
}
