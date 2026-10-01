import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessageSettingsForm } from '@/components/settings/message-settings-form'
import { getUserProfile } from '@/lib/queries/user-profile'

export default async function MessageSettingsPage() {
  const profile = await getUserProfile()

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Paramètres
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Messages de Sophie</h1>
        <p className="text-muted-foreground mt-2">
          Sur la fiche d&apos;une entreprise, Sophie peut préparer votre premier message à partir de ce qu&apos;elle
          sait de l&apos;entreprise. Ce qu&apos;elle doit savoir de vous se règle ici.
        </p>
      </div>

      <MessageSettingsForm pitch={profile?.message_pitch ?? null} signature={profile?.message_signature ?? null} />
    </div>
  )
}
