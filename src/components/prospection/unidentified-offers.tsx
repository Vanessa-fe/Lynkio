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
    try {
      const result = await dismissUnidentifiedOffer(offer.id)
      if (result.success) {
        router.refresh()
      } else {
        toast({ variant: 'destructive', title: 'Erreur', description: result.error })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: CONNECTION_ERROR })
    } finally {
      setBusyId(null)
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

// Appel au serveur impossible : réseau coupé, ou application mise à jour depuis
// l'ouverture de la page (les actions de l'ancienne version n'existent plus)
const CONNECTION_ERROR =
  'Le serveur n\'a pas répondu. Rechargez la page (l\'application a peut-être été mise à jour), puis réessayez.'

// Même comparaison que pour retrouver une entreprise : sans casse ni espaces superflus
function sameName(a: string, b: string) {
  return a.trim().toLocaleLowerCase('fr') === b.trim().toLocaleLowerCase('fr')
}

// Lieu France Travail « 69 - Lyon 3e Arrondissement » → « Lyon 3e Arrondissement »
function cityFromLocation(location: string | null): string {
  return location?.replace(/^\s*\d{2,3}\s*-\s*/, '').trim() ?? ''
}

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
  const [name, setName] = useState('')
  const [city, setCity] = useState(cityFromLocation(offer.location))
  const [website, setWebsite] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const existing = companies.find((company) => sameName(company.name, name))
  const isNew = !!name.trim() && !existing

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Indiquez le nom de l\'entreprise')
      return
    }

    setIsSaving(true)
    let result: Awaited<ReturnType<typeof linkUnidentifiedOffer>>
    try {
      result = await linkUnidentifiedOffer(
        offer.id,
        existing
          ? { companyId: existing.id }
          : { newCompany: { name: name.trim(), city: city.trim() || null, website: website.trim() || null } }
      )
    } catch {
      setError(CONNECTION_ERROR)
      return
    } finally {
      setIsSaving(false)
    }

    if (!result.success) {
      setError(result.error || 'Une erreur est survenue')
      return
    }

    toast({
      title: existing ? 'Offre rattachée' : 'Entreprise créée et offre rattachée',
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
          <DialogDescription>
            {offer.title}. Choisissez une entreprise que vous suivez, ou tapez le nom d&apos;une
            nouvelle : elle sera créée.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="linkCompanyName">Nom de l&apos;entreprise</Label>
            <Input
              id="linkCompanyName"
              list="linkCompanySuggestions"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Trouvé dans l'annonce"
              autoComplete="off"
              disabled={isSaving}
              autoFocus
            />
            <datalist id="linkCompanySuggestions">
              {companies.map((company) => (
                <option key={company.id} value={company.name} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {!name.trim()
                ? 'Vos entreprises vous sont proposées pendant la saisie.'
                : existing
                  ? `L'offre sera ajoutée à ${existing.name}, que vous suivez déjà.`
                  : 'Nouvelle entreprise : elle arrivera dans « À qualifier », avec l\'offre comme signal.'}
            </p>
          </div>

          {isNew && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="linkCompanyCity">Ville</Label>
                <Input
                  id="linkCompanyCity"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  autoComplete="off"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkCompanyWebsite">Site web (facultatif)</Label>
                <Input
                  id="linkCompanyWebsite"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="exemple.fr"
                  autoComplete="off"
                  disabled={isSaving}
                />
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground rounded-md bg-muted p-3">
            Offre publiée par un cabinet de recrutement (Michael Page, Hays…) ? Le cabinet n&apos;est pas
            votre client : cherchez l&apos;entreprise qui recrute (secteur, ville, taille, projet décrits
            dans l&apos;annonce). Si elle reste introuvable, ignorez l&apos;offre.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Rattachement...' : isNew ? 'Créer et rattacher' : 'Rattacher'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
