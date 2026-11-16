'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setSignalInvalidated } from '@/lib/actions/signals'
import { useToast } from '@/lib/hooks/use-toast'

/** « Ce signal est faux » / « Rétablir » : le score de la fiche est recalculé aussitôt */
export function SignalValidityButton({ signalId, invalidated }: { signalId: string; invalidated: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const toggle = () =>
    startTransition(async () => {
      const result = await setSignalInvalidated(signalId, !invalidated)
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Modification impossible', description: result.error })
        return
      }
      toast({
        title: invalidated ? 'Signal rétabli' : 'Signal écarté',
        description: invalidated
          ? 'Il compte de nouveau dans le score.'
          : 'Il reste affiché mais ne compte plus dans le score.',
      })
      router.refresh()
    })

  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={toggle} disabled={isPending}>
      {isPending ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : invalidated ? (
        <RotateCcw className="mr-1 h-3 w-3" />
      ) : (
        <Ban className="mr-1 h-3 w-3" />
      )}
      {invalidated ? 'Rétablir' : 'Ce signal est faux'}
    </Button>
  )
}
