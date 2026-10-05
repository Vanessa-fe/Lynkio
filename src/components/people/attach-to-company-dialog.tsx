'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { attachIndividualToCompany } from '@/lib/actions/people'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { OrganizationOption } from '@/lib/queries/people'

interface AttachToCompanyDialogProps {
  individualId: string
  personName: string
  organizations: OrganizationOption[]
}

/**
 * La personne seule rejoint une entreprise déjà suivie, ou une entreprise créée
 * à partir du nom tapé. Ses échanges et relances la suivent.
 */
export function AttachToCompanyDialog({ individualId, personName, organizations }: AttachToCompanyDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const name = companyName.trim()
  const existing = name
    ? organizations.find((organization) => organization.name.toLowerCase() === name.toLowerCase())
    : undefined

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof attachIndividualToCompany>>
    try {
      result = await attachIndividualToCompany(
        individualId,
        existing ? { companyId: existing.id } : { companyName: name }
      )
    } catch {
      setError(CONNECTION_ERROR)
      setIsSaving(false)
      return
    }

    if (!result.success || !result.data) {
      setError(result.error || 'Une erreur est survenue')
      setIsSaving(false)
      return
    }

    toast({ title: `${personName} rattaché·e à ${existing?.name ?? name}` })
    // La fiche de la personne n'existe plus : on va sur celle de l'entreprise
    router.replace(`/companies/${result.data.companyId}`)
    router.refresh()
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Building2 className="w-4 h-4 mr-2" />
        Rattacher à une entreprise
      </Button>

      <Dialog open={open} onOpenChange={(value) => !isSaving && setOpen(value)}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Rattacher {personName} à une entreprise</DialogTitle>
              <DialogDescription>
                La personne rejoint la fiche de l&apos;entreprise, avec ses échanges, ses relances et sa prochaine
                action. Sa fiche à elle disparaît.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="attach-company">Entreprise</Label>
              <Input
                id="attach-company"
                list="attach-organization-options"
                autoComplete="off"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Nom de l'entreprise"
                maxLength={200}
                disabled={isSaving}
                autoFocus
              />
              <datalist id="attach-organization-options">
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.name}>
                    {organization.city ?? ''}
                  </option>
                ))}
              </datalist>
              {name && (
                <p className="text-sm text-muted-foreground">
                  {existing
                    ? `Entreprise déjà suivie${existing.city ? ` (${existing.city})` : ''}.`
                    : 'Nouvelle entreprise : sa fiche sera créée.'}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving || !name}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Rattacher
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
