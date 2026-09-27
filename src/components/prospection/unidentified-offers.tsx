'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ExternalLink, EyeOff, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { dismissUnidentifiedOffer, linkUnidentifiedOffer } from '@/lib/actions/prospection'
import { useToast } from '@/lib/hooks/use-toast'
import type { UnidentifiedJobOffer } from '@/types'

interface UnidentifiedOffersProps {
  offers: UnidentifiedJobOffer[]
  companies: { id: string; name: string }[]
}

export function UnidentifiedOffers({ offers, companies }: UnidentifiedOffersProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [linkingOffer, setLinkingOffer] = useState<UnidentifiedJobOffer | null>(null)

  if (offers.length === 0) return null

  const handleDismiss = async (offer: UnidentifiedJobOffer) => {
    setBusyId(offer.id)
    const result = await dismissUnidentifiedOffer(offer.id)
    setBusyId(null)

    if (result.success) {
      router.refresh()
    } else {
      toast({ variant: 'destructive', title: 'Erreur', description: result.error })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offres à identifier</CardTitle>
        <CardDescription>
          Ces offres ne disent pas qui recrute. En ouvrant l&apos;annonce (description, adresse, contact),
          vous pouvez souvent retrouver l&apos;entreprise, puis la rattacher.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {offers.map((offer) => (
            <li key={offer.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{offer.title}</span>
                    {offer.signal_type === 'freelance_mission' && <Badge>Mission freelance</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[offer.location, offer.contract_type].filter(Boolean).join(' · ')}
                    {offer.published_at &&
                      ` · publiée ${formatDistanceToNow(new Date(offer.published_at), { addSuffix: true, locale: fr })}`}
                  </p>
                  {offer.url && (
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm inline-flex items-center gap-1 hover:underline"
                    >
                      Voir l&apos;annonce
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLinkingOffer(offer)}
                    disabled={busyId === offer.id}
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    Rattacher
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismiss(offer)}
                    disabled={busyId === offer.id}
                  >
                    <EyeOff className="w-4 h-4 mr-2" />
                    Ignorer
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      {linkingOffer && (
        <LinkOfferDialog
          offer={linkingOffer}
          companies={companies}
          onClose={() => setLinkingOffer(null)}
        />
      )}
    </Card>
  )
}

const NEW_COMPANY = 'new'

function LinkOfferDialog({
  offer,
  companies,
  onClose,
}: {
  offer: UnidentifiedJobOffer
  companies: { id: string; name: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [choice, setChoice] = useState<string>(NEW_COMPANY)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (choice === NEW_COMPANY && !newName.trim()) {
      setError('Indiquez le nom de l\'entreprise')
      return
    }

    setIsSaving(true)
    const result = await linkUnidentifiedOffer(
      offer.id,
      choice === NEW_COMPANY ? { newCompanyName: newName.trim() } : { companyId: choice }
    )
    setIsSaving(false)

    if (!result.success) {
      setError(result.error || 'Une erreur est survenue')
      return
    }

    toast({
      title: 'Offre rattachée',
      description: result.companyId ? (
        <Link href={`/companies/${result.companyId}`} className="underline">
          Voir l&apos;entreprise
        </Link>
      ) : undefined,
    })
    onClose()
    router.refresh()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rattacher l&apos;offre</DialogTitle>
          <DialogDescription>{offer.title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="linkCompany">Entreprise</Label>
            <Select value={choice} onValueChange={setChoice} disabled={isSaving}>
              <SelectTrigger id="linkCompany">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_COMPANY}>Nouvelle entreprise…</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {choice === NEW_COMPANY && (
            <div className="space-y-2">
              <Label htmlFor="newCompanyName">Nom de l&apos;entreprise</Label>
              <Input
                id="newCompanyName"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Trouvé dans l'annonce"
                disabled={isSaving}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Vous pourrez compléter sa fiche (site, SIREN, contacts) ensuite.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Rattachement...' : 'Rattacher'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
