'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Euro, ListTodo, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateCompany } from '@/lib/actions/companies'
import { formatEuros } from '@/lib/validations/company'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { CompanyWithRelations } from '@/types'

/**
 * Prochaine action et montant estimé, modifiables sur la fiche : on les met à jour
 * après chaque échange, sans passer par le formulaire complet
 */
export function CompanyNextStep({ company }: { company: CompanyWithRelations }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [nextAction, setNextAction] = useState('')
  const [amount, setAmount] = useState('')

  const startEditing = () => {
    setNextAction(company.next_action ?? '')
    setAmount(company.estimated_amount?.toString() ?? '')
    setIsEditing(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof updateCompany>>
    try {
      result = await updateCompany(company.id, { nextAction, estimatedAmount: amount })
    } catch {
      toast({ variant: 'destructive', title: 'Enregistrement impossible', description: CONNECTION_ERROR })
      return
    } finally {
      setIsSaving(false)
    }

    if (!result.success) {
      toast({ variant: 'destructive', title: 'Enregistrement impossible', description: result.error })
      return
    }

    setIsEditing(false)
    router.refresh()
  }

  if (isEditing) {
    return (
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border bg-muted/40 p-4 grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="next-action">Prochaine action</Label>
          <Input
            id="next-action"
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="Envoyer le devis, appeler la gérante..."
            maxLength={300}
            disabled={isSaving}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="estimated-amount">Montant estimé (€ HT)</Label>
          <Input
            id="estimated-amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="6 000"
            disabled={isSaving}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={isSaving} onClick={() => setIsEditing(false)}>
            Annuler
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-4 flex items-start justify-between gap-3">
      <dl className="grid gap-4 sm:grid-cols-[1fr_auto] flex-1 min-w-0">
        <div className="min-w-0">
          <dt className="text-sm text-muted-foreground flex items-center gap-2">
            <ListTodo className="w-4 h-4" />
            Prochaine action
          </dt>
          <dd className="font-medium break-words mt-1">
            {company.next_action ?? <span className="text-muted-foreground font-normal">À définir</span>}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground flex items-center gap-2">
            <Euro className="w-4 h-4" />
            Montant estimé
          </dt>
          <dd className="font-medium mt-1">
            {company.estimated_amount != null ? (
              `${formatEuros(company.estimated_amount)} HT`
            ) : (
              <span className="text-muted-foreground font-normal">Non estimé</span>
            )}
          </dd>
        </div>
      </dl>
      <Button variant="ghost" size="sm" onClick={startEditing} aria-label="Modifier la prochaine action et le montant">
        <Pencil className="w-4 h-4" />
        <span className="ml-2 hidden sm:inline">Modifier</span>
      </Button>
    </div>
  )
}
