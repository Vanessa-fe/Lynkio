'use client'

import { useOptimistic, useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateCompanyStage } from '@/lib/actions/companies'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/types'

interface CompanyStageSelectProps {
  companyId: string
  stageId: string | null
  stages: PipelineStage[]
  className?: string
}

function StageOption({ stage }: { stage: Pick<PipelineStage, 'name' | 'color'> }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
      <span className="truncate">{stage.name}</span>
    </div>
  )
}

/**
 * Changement d'étape directement depuis la liste ou la fiche.
 * La nouvelle étape s'affiche tout de suite (affichage « optimiste ») ; l'action
 * enregistre en arrière-plan et rafraîchit la page (revalidatePath). En cas
 * d'échec, l'ancienne étape revient d'elle-même et un message l'explique.
 */
export function CompanyStageSelect({ companyId, stageId, stages, className }: CompanyStageSelectProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [displayedStageId, setDisplayedStageId] = useOptimistic(stageId)

  const current = stages.find((stage) => stage.id === displayedStageId)

  const handleChange = (value: string) => {
    const nextStageId = value === 'none' ? null : value
    startTransition(async () => {
      setDisplayedStageId(nextStageId)
      let result: Awaited<ReturnType<typeof updateCompanyStage>>
      try {
        result = await updateCompanyStage(companyId, nextStageId)
      } catch {
        toast({ variant: 'destructive', title: 'Étape non enregistrée', description: CONNECTION_ERROR })
        return
      }
      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Étape non enregistrée',
          description: result.error || 'Impossible de changer l\'étape',
        })
      }
    })
  }

  return (
    <Select value={displayedStageId ?? 'none'} onValueChange={handleChange}>
      <SelectTrigger
        className={cn('h-9 w-[180px] transition-opacity', isPending && 'opacity-70', className)}
        aria-label="Étape du pipeline"
        aria-busy={isPending}
      >
        <SelectValue>
          {current ? (
            <StageOption stage={current} />
          ) : (
            <span className="text-muted-foreground">Sans étape</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="text-muted-foreground">Sans étape</span>
        </SelectItem>
        {stages.map((stage) => (
          <SelectItem key={stage.id} value={stage.id}>
            <StageOption stage={stage} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Score de 0 à 100 calculé par la qualification (règles ou IA)
 */
export function CompanyScore({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-sm text-muted-foreground">-</span>
  }

  const tone =
    score >= 70
      ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
      : score >= 40
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
        : 'bg-muted text-muted-foreground'

  return (
    <span className={cn('inline-flex min-w-10 justify-center rounded-md px-2 py-0.5 text-sm font-semibold', tone)}>
      {score}
    </span>
  )
}
