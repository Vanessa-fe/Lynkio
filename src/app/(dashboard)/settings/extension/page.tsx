import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExtensionConnection } from '@/components/settings/extension-connection'
import { LinkedinPostSearchCard } from '@/components/settings/linkedin-post-search'
import { createClient } from '@/lib/supabase/server'
import { getIcpBasics } from '@/lib/queries/icp'
import { getLinkedinPostSearch } from '@/lib/queries/linkedin-posts'
import { technologyLabel } from '@/lib/constants/technologies'
import { suggestedPostKeywords } from '@/lib/validations/linkedin-posts'

export default async function ExtensionSettingsPage() {
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    postSearch,
    icp,
  ] = await Promise.all([supabase.auth.getUser(), getLinkedinPostSearch(), getIcpBasics()])

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
          L&apos;extension Chrome de Filonea ajoute un bouton « + Filonea » sur les profils LinkedIn, envoie vos
          invitations et les messages de Sophie à votre rythme, et peut chercher les posts de personnes qui cherchent
          un freelance.
        </p>
      </div>

      <ExtensionConnection accountEmail={user?.email ?? null} />
      <LinkedinPostSearchCard search={postSearch} suggestions={suggestedPostKeywords(icp.techStack.map(technologyLabel))} />
    </div>
  )
}
