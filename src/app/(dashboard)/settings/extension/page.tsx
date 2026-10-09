import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExtensionConnection } from '@/components/settings/extension-connection'
import { createClient } from '@/lib/supabase/server'

export default async function ExtensionSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Paramètres
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Extension LinkedIn</h1>
        <p className="text-muted-foreground mt-2">
          L&apos;extension Chrome de Filonea ajoute un bouton « + Filonea » sur les profils LinkedIn. Elle enverra
          bientôt vos invitations et les messages de Sophie, à votre rythme.
        </p>
      </div>

      <ExtensionConnection accountEmail={user?.email ?? null} />
    </div>
  )
}
