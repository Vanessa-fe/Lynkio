import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APPROACH_LABELS, companyAgeRange, nafCodesForGroups, sectorLabelForNaf } from '@/lib/constants/client-sectors'
import { DEPARTMENTS } from '@/lib/validations/prospection'
import { formatDate } from '@/lib/utils/dates'
import { suggestApproachAngle } from '@/lib/utils/approach-angle'
import type { StrategyOverview } from '@/lib/queries/strategies'
import type { Company } from '@/types'

const SIZE_LABELS: Record<string, string> = {
  solo: 'indépendant, sans salarié',
  tpe: 'TPE (1 à 9 salariés)',
  pme: 'PME (10 à 249 salariés)',
  eti: 'ETI (250 à 4 999 salariés)',
  ge: 'grande entreprise',
}

/** Département d'un code postal (Corse : 2A/2B, outre-mer : 3 chiffres) — même règle que Sophie */
function departmentFromPostalCode(postalCode: string | null): string | null {
  if (!postalCode || !/^\d{5}$/.test(postalCode)) return null
  if (postalCode.startsWith('97') || postalCode.startsWith('98')) return postalCode.slice(0, 3)
  if (postalCode.startsWith('20')) return Number(postalCode) < 20200 ? '2A' : '2B'
  return postalCode.slice(0, 2)
}

const euros = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)

type Fact = { label: string; value: string; match?: string }

/**
 * « Pourquoi cette entreprise » : ce qui la rattache à votre recherche, avec la source et la date.
 * Seulement des faits du registre officiel ; aucun besoin n'est supposé quand aucun signal n'a été vu.
 */
export function CompanyWhyCard({
  company,
  strategy,
  signalCount,
  signalTypes = [],
  hasDecisionMaker,
}: {
  company: Company
  strategy: StrategyOverview | null
  signalCount: number
  // Types des signaux observés (pour l'angle d'approche suggéré)
  signalTypes?: string[]
  hasDecisionMaker: boolean
}) {
  if (!company.strategy_id) return null

  const nafCodes = strategy ? nafCodesForGroups(strategy.sectorGroups) : []
  const department = departmentFromPostalCode(company.postal_code)
  const facts: Fact[] = []

  if (company.naf_code) {
    const sector = sectorLabelForNaf(company.naf_code, strategy?.sectorGroups)
    facts.push({
      label: 'Activité',
      value: `${sector ?? company.sector ?? 'Code d’activité'} (code NAF ${company.naf_code})`,
      match: nafCodes.includes(company.naf_code) ? 'dans vos secteurs' : undefined,
    })
  }
  if (company.size_category) {
    facts.push({
      label: 'Taille',
      value: SIZE_LABELS[company.size_category] ?? company.size_category,
      match: strategy?.sizes.includes(company.size_category) ? 'taille recherchée' : undefined,
    })
  }
  if (company.city || company.postal_code) {
    const deptLabel = department ? DEPARTMENTS[department] : null
    facts.push({
      label: 'Siège',
      value: [company.city, company.postal_code && `(${company.postal_code}${deptLabel ? `, ${deptLabel}` : ''})`].filter(Boolean).join(' '),
      match: department && strategy?.departments.includes(department) ? 'dans votre zone' : undefined,
    })
  }
  if (company.founded_on) {
    const ageRange = companyAgeRange(company.founded_on)
    facts.push({
      label: 'Créée le',
      value: formatDate(new Date(company.founded_on), 'd MMMM yyyy'),
      match: ageRange && strategy?.ages.includes(ageRange) ? 'ancienneté recherchée' : undefined,
    })
  }
  if (company.revenue && company.finances_year) {
    facts.push({ label: 'Chiffre d’affaires', value: `${euros(company.revenue)} (comptes ${company.finances_year})` })
  }

  const suggestion = suggestApproachAngle({
    approach: strategy?.approach ?? null,
    sizeCategory: company.size_category,
    foundedOn: company.founded_on,
    signalTypes,
    hasDecisionMaker,
  })

  const unknowns = [
    !company.website && 'son site web',
    !hasDecisionMaker && 'le nom d’un dirigeant',
    !company.revenue && 'son chiffre d’affaires (comptes non publiés)',
  ].filter((item): item is string => !!item)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pourquoi cette entreprise</CardTitle>
        <CardDescription>
          {strategy ? (
            <>
              Trouvée par votre recherche <span className="font-medium text-foreground">« {strategy.name} »</span> (
              {APPROACH_LABELS[strategy.approach].toLowerCase()}).
            </>
          ) : (
            'Trouvée par une recherche que vous avez supprimée depuis.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <section className="space-y-2">
          <h3 className="font-medium">Faits vérifiés</h3>
          <ul className="space-y-1.5">
            {facts.map((fact) => (
              <li key={fact.label} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                <span className="text-muted-foreground sm:w-36 sm:shrink-0">{fact.label}</span>
                <span>
                  {fact.value}
                  {fact.match && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      ✓ {fact.match}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Source : registre officiel des entreprises (INSEE et registre national des entreprises, via l’API Recherche
            d’entreprises), consulté le {formatDate(new Date(company.collected_at), 'd MMMM yyyy')}.{' '}
            {company.registration_id && (
              <a
                href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${company.registration_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
              >
                Voir la fiche publique
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </p>
        </section>

        <section className="space-y-1">
          <h3 className="font-medium">Signaux d’achat</h3>
          <p className="text-muted-foreground">
            {signalCount === 0
              ? 'Aucun signal observé pour l’instant : Sophie ne sait pas si cette entreprise a un besoin en ce moment. Elle correspond seulement à votre profil de client.'
              : `${signalCount} signal${signalCount > 1 ? 's' : ''} observé${signalCount > 1 ? 's' : ''} : voir le détail plus bas.`}
          </p>
        </section>

        <section className="space-y-1.5 rounded-lg border border-dashed p-3">
          <h3 className="flex flex-wrap items-center gap-2 font-medium">
            Angle d’approche suggéré
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              hypothèse, à adapter
            </span>
          </h3>
          <p>{suggestion.angle}</p>
          <p className="text-xs text-muted-foreground">
            Pourquoi : {suggestion.because}. C’est une piste pour votre premier message, pas un besoin constaté.
          </p>
        </section>

        {unknowns.length > 0 && (
          <section className="space-y-1">
            <h3 className="font-medium">Encore inconnu</h3>
            <p className="text-muted-foreground">Sophie n’a pas trouvé {unknowns.join(', ')}.</p>
          </section>
        )}
      </CardContent>
    </Card>
  )
}
