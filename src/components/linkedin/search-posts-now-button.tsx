'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sendToExtension } from '@/lib/extension'
import { useToast } from '@/lib/hooks/use-toast'

// Plusieurs mots-clés, chacun lu dans l'onglet de recherche : une à deux minutes
const SEARCH_TIMEOUT_MS = 180_000

type SearchNowResult = { ok: true; found: number; kept: number } | { ok: false; error?: string }

function plural(count: number, one: string, many: string) {
  return `${count} ${count > 1 ? many : one}`
}

/**
 * « Chercher maintenant » : l'extension lance la recherche de posts tout de suite, dans un
 * onglet en arrière-plan, au lieu d'attendre son prochain passage
 */
export function SearchPostsNowButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    const result = await sendToExtension<SearchNowResult>({ type: 'search-posts-now' }, SEARCH_TIMEOUT_MS)
    setBusy(false)

    if (!result) {
      toast({
        variant: 'destructive',
        title: 'L\'extension n\'a pas répondu',
        description: 'Vérifiez qu\'elle est installée et connectée (Paramètres, Extension LinkedIn), puis réessayez.',
      })
      return
    }
    if (!result.ok) {
      toast({
        variant: 'destructive',
        title: 'Recherche impossible',
        // Une version plus ancienne de l'extension ne connaît pas ce message
        description:
          result.error === 'Message refusé'
            ? 'Mettez l\'extension à jour (version 0.3.1 ou plus) : bouton ↻ dans chrome://extensions.'
            : result.error,
      })
      return
    }
    toast({
      title: 'Recherche terminée',
      description: `${plural(result.found, 'post lu', 'posts lus')}, ${plural(result.kept, 'nouveau retenu', 'nouveaux retenus')} par Sophie.`,
    })
    router.refresh()
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={busy || disabled}>
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
      {busy ? 'Recherche en cours…' : 'Chercher maintenant'}
    </Button>
  )
}
