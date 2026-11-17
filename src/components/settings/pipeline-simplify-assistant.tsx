'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { simplifyPipeline } from '@/lib/actions/pipeline-settings'
import { planPipelineSimplification, type SimplifyStage, type SimplifyStepId } from '@/lib/pipeline-simplify'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'

const KIND_DOT: Record<string, string> = {
  open: 'bg-sky-500',
  won: 'bg-emerald-500',
  lost: 'bg-red-500',
  excluded: 'bg-stone-400',
}

/**
 * Assistant « Simplifier mon pipeline » (lot 1.11) : pour les comptes créés avec les anciennes étapes,
 * propose d'aligner le pipeline sur les étapes actuelles. Aperçu avant / après, chaque proposition se
 * décoche, rien ne change sans « Appliquer ». N'apparaît pas quand il n'y a rien à proposer.
 */
export function PipelineSimplifyAssistant({ stages, usage }: { stages: SimplifyStage[]; usage: Record<string, number> }) {
  const router = useRouter()
  const { toast } = useToast()
  const plan = useMemo(() => planPipelineSimplification(stages, usage), [stages, usage])
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<Set<SimplifyStepId>>(() => new Set(plan.steps.map((step) => step.id)))
  const [applying, setApplying] = useState(false)

  // Aperçu « après » recalculé avec les seules propositions cochées
  const preview = useMemo(() => {
    const kept = plan.steps.filter((step) => chosen.has(step.id)).map((step) => step.id)
    return planPipelineSimplification(stages, usage, new Set(kept)).after
  }, [plan.steps, chosen, stages, usage])

  if (plan.steps.length === 0) return null

  const toggle = (id: SimplifyStepId, checked: boolean) => {
    setChosen((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const apply = async () => {
    setApplying(true)
    try {
      const result = await simplifyPipeline([...chosen])
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Simplification impossible', description: result.error })
        return
      }
      toast({ title: 'Pipeline simplifié', description: 'Vos entreprises, échanges et relances sont conservés.' })
      setOpen(false)
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Simplification impossible', description: CONNECTION_ERROR })
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <Card className="border-wine/20 bg-wine/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-wine" aria-hidden="true" />
            Simplifier mon pipeline
          </CardTitle>
          <CardDescription>
            Votre pipeline date des premières versions de Filonéa. Je peux l’aligner sur les étapes actuelles :{' '}
            {plan.steps.length > 1 ? `${plan.steps.length} changements proposés` : 'un changement proposé'}, avec un
            aperçu avant / après. Rien ne change sans votre accord.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)}>Voir les propositions</Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(value) => !applying && setOpen(value)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Simplifier mon pipeline</DialogTitle>
            <DialogDescription>
              Décochez ce que vous voulez garder tel quel. Aucune entreprise, aucun échange ni aucune relance n’est
              supprimé.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-3">
            {plan.steps.map((step) => (
              <li key={step.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50">
                  <Checkbox
                    checked={chosen.has(step.id)}
                    onCheckedChange={(checked) => toggle(step.id, checked === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium">{step.title}</span>
                    <span className="block text-muted-foreground">{step.detail}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
            <StageColumn
              title="Aujourd’hui"
              items={plan.before.map((stage) => ({
                name: stage.name,
                kind: stage.kind,
                isDefault: stage.is_default,
                note: null,
              }))}
            />
            <ArrowRight className="mx-auto hidden h-5 w-5 self-center text-muted-foreground sm:block" aria-hidden="true" />
            <StageColumn
              title="Après"
              items={preview.map((stage) => ({
                name: stage.name,
                kind: stage.kind,
                isDefault: stage.isDefault,
                note: stage.isNew ? 'nouvelle' : stage.renamedFrom ? `ex-« ${stage.renamedFrom} »` : null,
              }))}
            />
          </div>
          <p className="text-xs text-muted-foreground">★ étape où arrivent les nouvelles entreprises.</p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={applying}>
              Annuler
            </Button>
            <Button onClick={apply} disabled={applying || chosen.size === 0}>
              {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Appliquer {chosen.size > 1 ? `les ${chosen.size} changements` : chosen.size === 1 ? 'ce changement' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StageColumn({
  title,
  items,
}: {
  title: string
  items: { name: string; kind: string; isDefault: boolean; note: string | null }[]
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ol className="space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item.name} className="flex items-center gap-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', KIND_DOT[item.kind] ?? 'bg-stone-400')} aria-hidden="true" />
            <span className={cn(item.note && 'font-medium')}>
              {item.name}
              {item.isDefault && ' ★'}
            </span>
            {item.note && <span className="text-xs text-wine">{item.note}</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}
