'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Ban, Building2, Loader2, Search, Sparkles } from 'lucide-react'
import { lookupCompany, type CompanyLookupCandidate, type CompanyLookupResult } from '@/lib/actions/company-lookup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export type CompanyLookupPick = {
  candidate: CompanyLookupCandidate
  website: string | null
  detectedStack: CompanyLookupResult['detectedStack']
}

interface CompanyLookupProps {
  disabled?: boolean
  onPick: (pick: CompanyLookupPick) => void
}

// Résultats montrés d'abord ; les suivants s'affichent sur demande
const FIRST_RESULTS = 8

const formatSiren = (siren: string) => siren.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')

/**
 * « Retrouver l'entreprise » : un nom, un SIREN ou un site suffit, Sophie propose
 * les fiches du registre officiel et pré-remplit le formulaire avec celle choisie
 */
export function CompanyLookup({ disabled, onPick }: CompanyLookupProps) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CompanyLookupResult | null>(null)
  const [pickedSiren, setPickedSiren] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const search = async () => {
    setError(null)
    setIsSearching(true)
    const response = await lookupCompany(query)
    setIsSearching(false)
    if (!response.success || !response.data) {
      setResult(null)
      setError(response.error ?? 'La recherche a échoué')
      return
    }
    setPickedSiren(null)
    setShowAll(false)
    setResult(response.data)
  }

  const pick = (candidate: CompanyLookupCandidate) => {
    if (!result) return
    setPickedSiren(candidate.siren)
    onPick({ candidate, website: result.website, detectedStack: result.detectedStack })
  }

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-3 bg-muted/30">
      <div className="space-y-1">
        <Label htmlFor="company-lookup" className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Retrouver l&apos;entreprise
        </Label>
        <p className="text-xs text-muted-foreground">
          Tapez son nom, son SIREN ou collez son site : Sophie cherche dans le registre officiel et remplit la fiche. Vous vérifiez avant d&apos;enregistrer.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          id="company-lookup"
          value={query}
          placeholder="Atelier Dupont, 123 456 789 ou atelier-dupont.fr"
          disabled={disabled || isSearching}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Entrée lance la recherche sans envoyer le formulaire
            if (event.key === 'Enter') {
              event.preventDefault()
              if (query.trim()) search()
            }
          }}
        />
        <Button type="button" onClick={search} disabled={disabled || isSearching || !query.trim()}>
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-2 hidden sm:inline">Rechercher</span>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-2" aria-live="polite">
          {result.note && <p className="text-xs text-muted-foreground">{result.note}</p>}
          {result.candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune entreprise trouvée. Essayez un autre nom, ou remplissez la fiche à la main.
            </p>
          ) : (
            <ul className="space-y-2">
              {(showAll ? result.candidates : result.candidates.slice(0, FIRST_RESULTS)).map((candidate) => (
                <CandidateRow
                  key={candidate.siren}
                  candidate={candidate}
                  picked={pickedSiren === candidate.siren}
                  disabled={disabled}
                  onPick={() => pick(candidate)}
                />
              ))}
            </ul>
          )}
          {!showAll && result.candidates.length > FIRST_RESULTS && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(true)}>
              Voir {result.candidates.length - FIRST_RESULTS} autres résultats
            </Button>
          )}
          {result.source === 'name' && (
            <p className="text-xs text-muted-foreground">
              Vous ne la voyez pas ? Le nom au registre est parfois différent du nom connu (par exemple « GFT France SAS » pour GFT Technologies). Son SIREN ou son site donnent un résultat exact.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function CandidateRow({
  candidate,
  picked,
  disabled,
  onPick,
}: {
  candidate: CompanyLookupCandidate
  picked: boolean
  disabled?: boolean
  onPick: () => void
}) {
  const place = [candidate.postalCode, candidate.city].filter(Boolean).join(' ')
  const details = [
    `SIREN ${formatSiren(candidate.siren)}`,
    place,
    candidate.sector,
    candidate.foundedOn ? `créée en ${candidate.foundedOn.slice(0, 4)}` : null,
    candidate.headcountLabel,
  ].filter(Boolean)

  return (
    <li
      className={`flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border bg-background p-3 ${
        picked ? 'border-primary ring-1 ring-primary' : ''
      } ${candidate.blockedReason ? 'opacity-70' : ''}`}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-medium flex items-center gap-2 flex-wrap">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          {candidate.name}
          {candidate.isClosed && <Badge variant="outline">Cessée</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{details.join(' · ')}</p>
        {candidate.blockedReason && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <Ban className="w-3 h-3" />
            {candidate.blockedReason} : Sophie ne la propose pas.
          </p>
        )}
        {candidate.existing && (
          <p className="text-xs">
            Déjà dans vos entreprises :{' '}
            <Link href={`/companies/${candidate.existing.id}`} className="underline font-medium">
              ouvrir la fiche
            </Link>
          </p>
        )}
      </div>
      {!candidate.blockedReason && !candidate.existing && (
        <Button type="button" size="sm" variant={picked ? 'default' : 'outline'} onClick={onPick} disabled={disabled}>
          {picked ? 'Choisie' : 'Choisir'}
        </Button>
      )}
    </li>
  )
}
