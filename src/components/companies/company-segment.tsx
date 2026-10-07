'use client'

import { useOptimistic, useTransition } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateCompanySegment } from '@/lib/actions/companies'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { SEGMENTS, segmentDescriptions, segmentLabels, segmentTones } from '@/lib/constants/segments'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { CompanySegment, CompanySegmentSetBy } from '@/types'

/**
 * Pastille du segment (Agence, TPE/PME, Startup/SaaS)
 */
export function SegmentBadge({ segment, className }: { segment: CompanySegment | null; className?: string }) {
  if (!segment) return null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        segmentTones[segment],
        className
      )}
      title={segmentDescriptions[segment]}
    >
      {segmentLabels[segment]}
    </span>
  )
}

const NONE = 'none'
const AUTO = 'auto'

/**
 * Choix du segment sur la fiche. « Deviné par Filonea » rend la main à la base,
 * qui le recalcule d'après le code d'activité, le nom et la taille.
 */
export function CompanySegmentSelect({
  companyId,
  segment,
  setBy,
  className,
}: {
  companyId: string
  segment: CompanySegment | null
  setBy: CompanySegmentSetBy
  className?: string
}) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [displayed, setDisplayed] = useOptimistic({ segment, setBy })

  const handleChange = (value: string) => {
    const next = value === AUTO ? 'auto' : value === NONE ? null : (value as CompanySegment)
    startTransition(async () => {
      setDisplayed(next === 'auto' ? { segment: displayed.segment, setBy: 'auto' } : { segment: next, setBy: 'manual' })
      let result: Awaited<ReturnType<typeof updateCompanySegment>>
      try {
        result = await updateCompanySegment(companyId, next)
      } catch {
        toast({ variant: 'destructive', title: 'Segment non enregistré', description: CONNECTION_ERROR })
        return
      }
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Segment non enregistré', description: result.error })
      }
    })
  }

  return (
    <Select value={displayed.segment ?? NONE} onValueChange={handleChange}>
      <SelectTrigger
        className={cn('h-9 w-[180px] transition-opacity', isPending && 'opacity-70', className)}
        aria-label="Segment"
        aria-busy={isPending}
      >
        <SelectValue>
          <span className="flex items-center gap-2">
            {displayed.segment ? (
              <SegmentBadge segment={displayed.segment} />
            ) : (
              <span className="text-muted-foreground">Non classé</span>
            )}
            {displayed.setBy === 'auto' && <span className="text-xs text-muted-foreground">deviné</span>}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SEGMENTS.map((value) => (
          <SelectItem key={value} value={value}>
            <SegmentBadge segment={value} />
          </SelectItem>
        ))}
        <SelectItem value={NONE}>
          <span className="text-muted-foreground">Non classé</span>
        </SelectItem>
        {displayed.setBy === 'manual' && (
          <SelectItem value={AUTO}>
            <span className="text-muted-foreground">Laisser Filonea deviner</span>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}
