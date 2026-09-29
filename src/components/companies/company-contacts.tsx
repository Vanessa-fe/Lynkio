'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Phone, Plus, Pencil, Trash2, Ban, Undo2, User, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { deleteCompanyContact, setCompanyContactLinkedin, setCompanyContactOptOut } from '@/lib/actions/company-contacts'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { contactDisplayName, formatPhoneForDisplay, linkedinPeopleSearchUrl } from '@/lib/validations/company'
import { useToast } from '@/lib/hooks/use-toast'
import type { CompanyContact } from '@/types'
import { CompanyContactDialog } from './company-contact-dialog'
import { formatDate } from '@/lib/utils/dates'

interface CompanyContactsProps {
  companyId: string
  // Pour la recherche LinkedIn de la personne (nom + entreprise)
  companyName: string
  website: string | null
  contacts: CompanyContact[]
}

export function CompanyContacts({ companyId, companyName, website, contacts }: CompanyContactsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [dialogContact, setDialogContact] = useState<CompanyContact | undefined>()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const openDialog = (contact?: CompanyContact) => {
    setDialogContact(contact)
    setIsDialogOpen(true)
  }

  const runAction = async (
    contactId: string,
    action: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string
  ) => {
    setBusyId(contactId)
    const result = await action()
    setBusyId(null)

    if (result.success) {
      toast({ title: successMessage })
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    }
  }

  const handleDelete = (contact: CompanyContact) => {
    if (!confirm(`Supprimer ${contactDisplayName(contact)} ?`)) return
    runAction(contact.id, () => deleteCompanyContact(contact.id, companyId), 'Contact supprimé')
  }

  const handleOptOut = (contact: CompanyContact) => {
    const optingOut = !contact.opted_out_at
    if (
      optingOut &&
      !confirm(`${contactDisplayName(contact)} ne souhaite plus être contacté·e ? Sophie l'ignorera.`)
    ) {
      return
    }
    runAction(
      contact.id,
      () => setCompanyContactOptOut(contact.id, companyId, optingOut),
      optingOut ? 'Opposition enregistrée' : 'Opposition annulée'
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>Les personnes à qui écrire dans cette entreprise</CardDescription>
          </div>
          <Button size="sm" onClick={() => openDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un contact
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun contact pour l&apos;instant.
            {website && ' Hunter.io peut vous proposer des e-mails à partir du site.'}
          </p>
        ) : (
          <ul className="divide-y">
            {contacts.map((contact) => {
              const optedOut = !!contact.opted_out_at

              return (
                <li key={contact.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className={optedOut ? 'font-medium line-through' : 'font-medium'}>
                          {contactDisplayName(contact)}
                        </span>
                        {contact.is_decision_maker && <Badge variant="secondary">Décideur</Badge>}
                        {optedOut && (
                          <Badge variant="destructive">
                            Ne pas contacter
                          </Badge>
                        )}
                      </div>
                      {contact.role && <p className="text-sm text-muted-foreground">{contact.role}</p>}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {contact.email && (
                          <a
                            href={optedOut ? undefined : `mailto:${contact.email}`}
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                            {contact.email}
                            {contact.email_source === 'hunter' && (
                              <span className="text-xs text-muted-foreground">
                                (Hunter
                                {contact.email_confidence !== null && `, ${contact.email_confidence} %`})
                              </span>
                            )}
                          </a>
                        )}
                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                            {formatPhoneForDisplay(contact.phone)}
                          </a>
                        )}
                        {contact.linkedin_url && (
                          <a
                            href={contact.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <LinkedinIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            LinkedIn
                          </a>
                        )}
                      </div>

                      {!contact.linkedin_url && !optedOut && (
                        <LinkedinQuickAdd contact={contact} companyId={companyId} companyName={companyName} />
                      )}

                      {contact.notes && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
                      )}
                      {optedOut && contact.opted_out_at && (
                        <p className="text-xs text-muted-foreground">
                          Opposition enregistrée le{' '}
                          {formatDate(new Date(contact.opted_out_at), 'dd MMMM yyyy')}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDialog(contact)}
                        disabled={busyId === contact.id}
                        aria-label={`Modifier ${contactDisplayName(contact)}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOptOut(contact)}
                        disabled={busyId === contact.id}
                        title={optedOut ? 'Annuler l\'opposition' : 'Ne souhaite plus être contacté·e'}
                        aria-label={
                          optedOut
                            ? `Annuler l'opposition de ${contactDisplayName(contact)}`
                            : `${contactDisplayName(contact)} ne souhaite plus être contacté·e`
                        }
                      >
                        {optedOut ? <Undo2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(contact)}
                        disabled={busyId === contact.id}
                        aria-label={`Supprimer ${contactDisplayName(contact)}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      {isDialogOpen && (
        <CompanyContactDialog
          key={dialogContact?.id ?? 'new'}
          companyId={companyId}
          website={website}
          contact={dialogContact}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </Card>
  )
}

/**
 * Contact sans profil LinkedIn : recherche LinkedIn pré-remplie (nom + entreprise),
 * puis champ pour coller l'adresse du profil trouvé (nécessaire pour Waalaxy)
 */
function LinkedinQuickAdd({
  contact,
  companyId,
  companyName,
}: {
  contact: CompanyContact
  companyId: string
  companyName: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof setCompanyContactLinkedin>>
    try {
      result = await setCompanyContactLinkedin(contact.id, companyId, url)
    } catch {
      toast({ variant: 'destructive', title: 'Profil non enregistré', description: CONNECTION_ERROR })
      return
    } finally {
      setIsSaving(false)
    }

    if (result.success) {
      toast({ title: 'Profil LinkedIn enregistré' })
      setIsEditing(false)
      setUrl('')
      router.refresh()
    } else {
      toast({ variant: 'destructive', title: 'Profil non enregistré', description: result.error })
    }
  }

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <a
          href={linkedinPeopleSearchUrl(contact, companyName)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <Search className="w-3.5 h-3.5" />
          Chercher sur LinkedIn
        </a>
        <button type="button" onClick={() => setIsEditing(true)} className="text-muted-foreground hover:underline">
          Ajouter son profil
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-2 pt-1 sm:max-w-lg">
      <Input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://www.linkedin.com/in/prenom-nom"
        aria-label={`Profil LinkedIn de ${contactDisplayName(contact)}`}
        className="h-9"
        autoFocus
        disabled={isSaving}
      />
      <div className="flex gap-2 shrink-0">
        <Button type="submit" size="sm" disabled={isSaving || !url.trim()}>
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
