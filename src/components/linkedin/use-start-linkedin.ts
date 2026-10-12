'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startLinkedinSequences, type StartSource, type StartSummary } from '@/lib/actions/linkedin-sequences'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'

function plural(count: number, one: string, many: string) {
  return `${count} ${count > 1 ? many : one}`
}

// « 3 déjà contactées, 1 sans profil LinkedIn… » : les personnes écartées et pourquoi
function skippedSummary({ skipped }: StartSummary): string | null {
  const parts = [
    skipped.inProgress && plural(skipped.inProgress, 'déjà en cours d\'envoi', 'déjà en cours d\'envoi'),
    skipped.contacted && plural(skipped.contacted, 'déjà contactée', 'déjà contactées'),
    skipped.noLinkedin && plural(skipped.noLinkedin, 'sans profil LinkedIn', 'sans profil LinkedIn'),
    skipped.closed && plural(skipped.closed, 'sur une fiche close', 'sur une fiche close'),
    skipped.optedOut && plural(skipped.optedOut, 'qui ne veut plus être contactée', 'qui ne veulent plus être contactées'),
  ].filter(Boolean)
  return parts.length > 0 ? `Écartées : ${parts.join(', ')}.` : null
}

/**
 * Ajoute une liste ou une sélection à l'envoi LinkedIn, dit qui a été écarté et pourquoi,
 * puis ouvre la page d'envoi où Sophie rédige les messages.
 */
export function useStartLinkedin() {
  const router = useRouter()
  const { toast } = useToast()
  const [isStarting, setIsStarting] = useState(false)

  const start = async (source: StartSource): Promise<boolean> => {
    setIsStarting(true)
    let result: Awaited<ReturnType<typeof startLinkedinSequences>>
    try {
      result = await startLinkedinSequences(source)
    } catch {
      toast({ variant: 'destructive', title: 'Envoi impossible', description: CONNECTION_ERROR })
      setIsStarting(false)
      return false
    }
    setIsStarting(false)
    if (!result.success || !result.data) {
      toast({ variant: 'destructive', title: 'Envoi impossible', description: result.error })
      return false
    }
    const { added } = result.data
    const skipped = skippedSummary(result.data)
    if (added === 0) {
      toast({ title: 'Personne de nouveau à envoyer', description: skipped ?? undefined })
      return false
    }
    toast({
      title: `${plural(added, 'personne ajoutée', 'personnes ajoutées')} à l'envoi LinkedIn`,
      description: skipped ?? 'Sophie peut maintenant rédiger leurs messages.',
    })
    router.push('/people/linkedin')
    return true
  }

  return { start, isStarting }
}
