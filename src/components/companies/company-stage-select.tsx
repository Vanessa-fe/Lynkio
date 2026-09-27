'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateCompanyStage } from '@/lib/actions/companies'
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
 * Changement d'étape directement depuis la liste ou la fiche
 */
export function CompanyStageSelect({ companyId, stageId, stages, className }: CompanyStageSelectProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const current = stages.find((stage) => stage.id === stageId)

  const handleChange = async (value: string) => {
    setIsSaving(true)
    const result = await updateCompanyStage(companyId, value === 'none' ? null : value)
    setIsSaving(false)

    if (result.success) {
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Impossible de changer l\'étape',
      })
    }
  }

  return (
    <Select value={stageId ?? 'none'} onValueChange={handleChange} disabled={isSaving}>
      <SelectTrigger className={cn('h-9 w-[180px]', className)} aria-label="Étape du pipeline">
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
