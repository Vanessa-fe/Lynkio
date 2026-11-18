import { ShieldCheck } from 'lucide-react'
import { ApiKeysSettings } from '@/components/settings/api-keys-settings'
import { getMyAiProvider, getMyApiKeys } from '@/lib/queries/api-keys'
import { SophieSettings } from '@/components/settings/sophie-settings'
import { getUserProfile } from '@/lib/queries/user-profile'
import { createClient } from '@/lib/supabase/server'

export default async function ApiKeysSettingsPage() {
  const supabase = await createClient()
  const [savedKeys, aiProvider, profile, { data: retention }] = await Promise.all([
    getMyApiKeys(),
    getMyAiProvider(),
    getUserProfile(),
    supabase.from('data_retention_settings').select('sophie_chat_months').maybeSingle(),
  ])

  return (
    <div className="space-y-6 max-w-4xl">

      <div>
        <h1 className="text-3xl font-bold">Vos clés</h1>
      </div>

      <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <span>
          Vos clés sont vérifiées puis chiffrées. Filonea ne les affiche plus jamais (seulement leurs 4 derniers
          caractères) et ne s&apos;en sert que pour les demandes que vous faites à Sophie.
        </span>
      </p>

      <ApiKeysSettings savedKeys={savedKeys} aiProvider={aiProvider} />

      <SophieSettings
        autoOpen={profile?.sophie_auto_open ?? true}
        suggestions={profile?.sophie_suggestions ?? true}
        dailyMessages={profile?.sophie_daily_messages ?? 100}
        chatMonths={retention?.sophie_chat_months ?? 12}
      />
    </div>
  )
}
