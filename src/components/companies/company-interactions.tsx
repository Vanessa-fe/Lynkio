'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Activity,
  CalendarDays,
  Clock,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  companyInteractionSchema,
  companyInteractionStatuses,
  companyInteractionStatusLabels,
  companyInteractionTypeLabels,
  companyInteractionTypes,
  contactDisplayName,
  type CompanyInteractionInput,
} from '@/lib/validations/company'
import { createCompanyInteraction, deleteCompanyInteraction } from '@/lib/actions/company-interactions'
import { useToast } from '@/lib/hooks/use-toast'
import type { CompanyContact, CompanyInteractionType, CompanyInteractionWithContact } from '@/types'
import { formatDate } from '@/lib/utils/dates'

const typeIcons: Record<CompanyInteractionType, React.ReactNode> = {
  email: <Mail className="w-5 h-5" />,
  linkedin_message: <MessageSquare className="w-5 h-5" />,
  call: <Phone className="w-5 h-5" />,
  meeting: <CalendarDays className="w-5 h-5" />,
  note: <FileText className="w-5 h-5" />,
  system_event: <Activity className="w-5 h-5" />,
}

const typeColors: Record<CompanyInteractionType, string> = {
  email: 'text-blue-600 bg-blue-50 dark:bg-blue-950',
  linkedin_message: 'text-sky-600 bg-sky-50 dark:bg-sky-950',
  call: 'text-green-600 bg-green-50 dark:bg-green-950',
  meeting: 'text-purple-600 bg-purple-50 dark:bg-purple-950',
  note: 'text-amber-600 bg-amber-50 dark:bg-amber-950',
  system_event: 'text-gray-600 bg-gray-50 dark:bg-gray-900',
}

const NONE = 'none'

interface CompanyInteractionsProps {
  companyId: string
  contacts: CompanyContact[]
  interactions: CompanyInteractionWithContact[]
}

export function CompanyInteractions({ companyId, contacts, interactions }: CompanyInteractionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (interaction: CompanyInteractionWithContact) => {
    if (!confirm(`Supprimer cet échange (${companyInteractionTypeLabels[interaction.type]}) ?`)) return

    setDeletingId(interaction.id)
    const result = await deleteCompanyInteraction(interaction.id, companyId)
    setDeletingId(null)

    if (result.success) {
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
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Échanges</CardTitle>
            <CardDescription>
              {interactions.length === 0
                ? 'Aucun échange enregistré'
                : `${interactions.length} échange${interactions.length > 1 ? 's' : ''}`}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un échange
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {interactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Notez ici chaque e-mail, message, appel ou rendez-vous : la date du dernier échange
            vous aidera à savoir quand relancer.
          </p>
        ) : (
          <div className="relative">
            <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-border" aria-hidden="true" />
            <ol className="space-y-6">
              {interactions.map((interaction) => {
                const occurredAt = new Date(interaction.occurred_at)

                return (
                  <li key={interaction.id} className="relative flex gap-4 group">
                    <div
                      className={`relative z-10 flex items-center justify-center w-12 h-12 shrink-0 rounded-full border-2 border-background ${typeColors[interaction.type]}`}
                    >
                      {typeIcons[interaction.type]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{companyInteractionTypeLabels[interaction.type]}</h3>
                            {interaction.direction && (
                              <span className="text-sm text-muted-foreground">
                                {interaction.direction === 'incoming' ? 'reçu' : 'envoyé'}
                              </span>
                            )}
                            {interaction.status !== 'done' && (
                              <Badge variant="outline">{companyInteractionStatusLabels[interaction.status]}</Badge>
                            )}
                            {interaction.contact && (
                              <span className="text-sm text-muted-foreground">
                                · {contactDisplayName(interaction.contact)}
                              </span>
                            )}
                          </div>

                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <time dateTime={interaction.occurred_at}>
                              {formatDate(occurredAt, 'dd MMMM yyyy à HH:mm')}
                            </time>
                            <span className="text-xs">
                              ({formatDistanceToNow(occurredAt, { addSuffix: true, locale: fr })})
                            </span>
                          </p>

                          {interaction.subject && <p className="text-sm font-medium">{interaction.subject}</p>}
                          {interaction.content && (
                            <div className="mt-2 p-3 rounded-lg bg-muted">
                              <p className="text-sm whitespace-pre-wrap">{interaction.content}</p>
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(interaction)}
                          disabled={deletingId === interaction.id}
                          className="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          aria-label="Supprimer cet échange"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </CardContent>

      {isDialogOpen && (
        <CompanyInteractionDialog
          companyId={companyId}
          contacts={contacts}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </Card>
  )
}

// Valeur attendue par <input type="datetime-local"> : heure locale, sans fuseau
function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function CompanyInteractionDialog({
  companyId,
  contacts,
  open,
  onOpenChange,
}: {
  companyId: string
  contacts: CompanyContact[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reachableContacts = contacts.filter((contact) => !contact.opted_out_at)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyInteractionInput>({
    resolver: zodResolver(companyInteractionSchema),
    defaultValues: {
      companyId,
      type: 'email',
      status: 'done',
      direction: 'outgoing',
      contactId: reachableContacts.length === 1 ? reachableContacts[0]?.id : null,
      // Le champ datetime-local manipule une chaîne ; zod la convertit en Date à la validation
      occurredAt: toLocalInputValue(new Date()) as unknown as Date,
    },
  })

  const selectedType = useWatch({ control, name: 'type' })
  const isNote = selectedType === 'note'

  const onSubmit = async (data: CompanyInteractionInput) => {
    setError(null)
    setIsLoading(true)
    const result = await createCompanyInteraction(data)
    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Une erreur est survenue')
      return
    }

    toast({ title: 'Échange enregistré' })
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un échange</DialogTitle>
          <DialogDescription>Un e-mail, un message, un appel, un rendez-vous ou une note.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {companyInteractionTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {companyInteractionTypeLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {companyInteractionStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {companyInteractionStatusLabels[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isNote && (
              <div className="space-y-2">
                <Label htmlFor="direction">Sens</Label>
                <Controller
                  name="direction"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? 'outgoing'}
                      onValueChange={field.onChange}
                      disabled={isLoading}
                    >
                      <SelectTrigger id="direction">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outgoing">Envoyé par moi</SelectItem>
                        <SelectItem value="incoming">Reçu de l&apos;entreprise</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="occurredAt">Date et heure</Label>
              <Input id="occurredAt" type="datetime-local" disabled={isLoading} {...register('occurredAt')} />
              {errors.occurredAt && <p className="text-sm text-destructive">{errors.occurredAt.message}</p>}
            </div>
          </div>

          {contacts.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="contactId">Contact</Label>
              <Controller
                name="contactId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="contactId">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Aucun en particulier</SelectItem>
                      {reachableContacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contactDisplayName(contact)}
                          {contact.role && ` · ${contact.role}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {selectedType === 'email' && (
            <div className="space-y-2">
              <Label htmlFor="subject">Objet</Label>
              <Input id="subject" disabled={isLoading} {...register('subject')} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="content">{isNote ? 'Note' : 'Contenu (facultatif)'}</Label>
            <Textarea
              id="content"
              rows={5}
              placeholder={isNote ? 'Ce que vous voulez retenir...' : 'Texte du message, résumé de l\'appel...'}
              disabled={isLoading}
              {...register('content')}
            />
            {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
