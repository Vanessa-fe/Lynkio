'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createReminder } from '@/lib/actions/reminders'
import { useToast } from '@/lib/hooks/use-toast'
import {
  createReminderSchema,
  reminderPriorities,
  reminderPriorityLabels,
  type CreateReminderInput,
} from '@/lib/validations/reminder'
import { Plus, Bell } from 'lucide-react'

interface ReminderFormDialogProps {
  contactId?: string
  agencyId?: string
  companyId?: string
  // Sans cible imposée : entreprises proposées pendant la saisie
  companies?: { id: string; name: string }[]
  triggerVariant?: 'default' | 'icon'
  triggerLabel?: string
}

// Raccourcis de date : en prospection, on relance « dans X jours », le matin
const DUE_SHORTCUTS = [
  { label: 'Demain', days: 1 },
  { label: 'Dans 3 jours', days: 3 },
  { label: 'Dans 1 semaine', days: 7 },
  { label: 'Dans 2 semaines', days: 14 },
]

// Valeur attendue par <input type="datetime-local"> : heure locale, sans fuseau
function localInputValue(daysFromNow: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  date.setHours(9, 0, 0, 0)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function sameName(a: string, b: string) {
  return a.trim().toLocaleLowerCase('fr') === b.trim().toLocaleLowerCase('fr')
}

export function ReminderFormDialog({
  contactId,
  agencyId,
  companyId,
  companies,
  triggerVariant = 'default',
  triggerLabel = 'Nouvelle relance',
}: ReminderFormDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyError, setCompanyError] = useState<string | null>(null)

  const canPickCompany = !contactId && !agencyId && !companyId && !!companies

  const defaultValues = {
    contactId: contactId ?? undefined,
    agencyId: agencyId ?? undefined,
    companyId: companyId ?? undefined,
    priority: 'medium' as const,
    // Le champ datetime-local manipule une chaîne ; zod la convertit en Date à la validation
    dueAt: localInputValue(3) as unknown as Date,
  }

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<CreateReminderInput>({
    resolver: zodResolver(createReminderSchema),
    defaultValues,
  })

  const dueAt = useWatch({ control, name: 'dueAt' }) as unknown as string

  const onSubmit = async (data: CreateReminderInput) => {
    setCompanyError(null)

    let targetCompanyId = data.companyId
    if (canPickCompany && companyName.trim()) {
      const company = companies?.find((item) => sameName(item.name, companyName))
      if (!company) {
        setCompanyError('Choisissez une entreprise parmi celles que vous suivez')
        return
      }
      targetCompanyId = company.id
    }

    setIsSubmitting(true)
    const result = await createReminder({ ...data, companyId: targetCompanyId })
    setIsSubmitting(false)

    if (result.success) {
      toast({ title: 'Relance créée' })
      setOpen(false)
      reset({ ...defaultValues, dueAt: localInputValue(3) as unknown as Date })
      setCompanyName('')
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerVariant === 'icon' ? (
          <Button size="sm" variant="outline" aria-label={triggerLabel}>
            <Bell className="w-4 h-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Créer une relance</DialogTitle>
          <DialogDescription>Un rappel pour ne pas laisser filer une piste.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="title">
              Quoi faire <span className="text-destructive">*</span>
            </Label>
            <Input id="title" {...register('title')} placeholder="Relancer après le premier e-mail" />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          {canPickCompany && (
            <div className="space-y-2">
              <Label htmlFor="reminderCompany">Entreprise (facultatif)</Label>
              <Input
                id="reminderCompany"
                list="reminderCompanySuggestions"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Tapez le nom d'une entreprise suivie"
                autoComplete="off"
              />
              <datalist id="reminderCompanySuggestions">
                {companies?.map((company) => <option key={company.id} value={company.name} />)}
              </datalist>
              {companyError && <p className="text-sm text-destructive">{companyError}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="dueAt">
              Quand <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Raccourcis de date">
              {DUE_SHORTCUTS.map((shortcut) => {
                const value = localInputValue(shortcut.days)
                return (
                  <Button
                    key={shortcut.days}
                    type="button"
                    size="sm"
                    variant={dueAt === value ? 'default' : 'outline'}
                    aria-pressed={dueAt === value}
                    onClick={() => setValue('dueAt', value as unknown as Date, { shouldValidate: true })}
                  >
                    {shortcut.label}
                  </Button>
                )
              })}
            </div>
            <Input id="dueAt" type="datetime-local" {...register('dueAt')} />
            {errors.dueAt && <p className="text-sm text-destructive">{errors.dueAt.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priorité</Label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="priority" className="sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderPriorities.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {reminderPriorityLabels[priority]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
