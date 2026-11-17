'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft,
  Building2,
  Cake,
  Calendar,
  Edit,
  Euro,
  ExternalLink,
  FileText,
  Globe,
  Hash,
  Loader2,
  MapPin,
  MessageSquare,
  ScanSearch,
  Tag,
  Trash2,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Counter } from '@/components/motion/counter'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { analyzeCompanyWebsite, deleteCompany } from '@/lib/actions/companies'
import { technologyLabel } from '@/lib/constants/technologies'
import {
  companyAge,
  formatEuros,
  individualLabel,
  sizeCategoryLabels,
  toWebsiteDomain,
  toWebsiteUrl,
} from '@/lib/validations/company'
import { budgetFit, minimumRevenue } from '@/lib/validations/icp'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type {
  CompanyContact,
  CompanyInteractionWithContact,
  CompanyQualification,
  CompanySignalWithType,
  CompanyWithRelations,
  PipelineStage,
  ReminderWithRelations,
} from '@/types'
import { CompanyStageSelect } from './company-stage-select'
import { CompanyContacts } from './company-contacts'
import { CompanyInteractions } from './company-interactions'
import { CompanyScoreCard } from './company-score-card'
import { CompanyWhyCard } from './company-why-card'
import { CompanyStageHistory } from './company-stage-history'
import type { CompanyStageEvent } from '@/lib/queries/companies'
import type { StrategyOverview } from '@/lib/queries/strategies'
import { CompanyNextStep } from './company-next-step'
import { CompanySegmentSelect } from './company-segment'
import { AttachToCompanyDialog } from '@/components/people/attach-to-company-dialog'
import type { OrganizationOption, PersonRow } from '@/lib/queries/people'
import { RemindersList } from '@/components/reminders/reminders-list'
import { formatDate } from '@/lib/utils/dates'
import {
  SIGNAL_NATURE_LABELS,
  SIGNAL_NATURE_TONES,
  SIGNAL_RELIABILITY_LABELS,
  SIGNAL_SOURCE_LABELS,
  hasSignalProof,
  signalNature,
  signalReliability,
} from '@/lib/constants/signals'
import { cn } from '@/lib/utils/cn'
import { SignalValidityButton } from './signal-validity-button'
import { CompanyDeepDiveCard } from './company-deep-dive-card'
import type { DeepAnalysisView } from '@/lib/deep-analysis'
import { ProvenanceBadge, companyProvenance } from './provenance-badge'
import { ProspectingToggle } from './prospecting-toggle'
import type { SignalExplanation } from '@/lib/signal-explanation'

interface CompanyDetailProps {
  company: CompanyWithRelations
  stages: PipelineStage[]
  contacts: CompanyContact[]
  signals: CompanySignalWithType[]
  interactions: CompanyInteractionWithContact[]
  // Relances (lot 1.8c) : rang de chaque envoi resté sans réponse, par identifiant d'échange
  followUps: Record<string, number>
  qualification: CompanyQualification | null
  reminders: ReminderWithRelations[]
  // Tarif journalier du client idéal : sert à juger le budget de l'entreprise
  dayRate: number | null
  // Présentation remplie : Sophie peut personnaliser les messages qu'elle prépare
  hasPitch: boolean
  // Personne seule : entreprises auxquelles la rattacher
  organizations: OrganizationOption[]
  // Statut de prospection de chaque contact, par identifiant
  outreach: Record<string, PersonRow['outreach']>
  // Arrivée depuis un post LinkedIn (« Écrire un e-mail avec Sophie ») : la rédaction s'ouvre tout de suite
  openEmailDraft?: boolean
  // Recherche enregistrée qui a trouvé la fiche (« Pourquoi cette entreprise »)
  strategy?: StrategyOverview | null
  // Journal des changements d'étape, du plus récent au plus ancien
  stageEvents?: CompanyStageEvent[]
  // Dernière analyse approfondie (« Approfondir avec Sophie »)
  deepAnalysis?: DeepAnalysisView | null
  hasAiKey?: boolean
  // Constat, piste et prestation de chaque signal, par identifiant (calculés côté serveur)
  explanations?: Record<string, SignalExplanation>
}

/**
 * Budget estimé au regard du tarif journalier : une mission de 20 jours ne doit
 * pas peser plus de 4 % du chiffre d'affaires
 */
function BudgetBadge({ revenue, dayRate }: { revenue: number; dayRate: number | null }) {
  const fit = budgetFit(revenue, dayRate)
  if (fit === 'unknown' || !dayRate) return null
  return (
    <Badge
      variant={fit === 'comfortable' ? 'secondary' : 'outline'}
      className="ml-2 font-normal"
      title={`Au tarif de ${formatEuros(dayRate)} par jour, il faut environ ${formatEuros(minimumRevenue(dayRate))} de chiffre d'affaires`}
    >
      {fit === 'comfortable' ? 'Budget confortable' : 'Budget serré'}
    </Badge>
  )
}

export function CompanyDetail({
  company,
  stages,
  contacts,
  signals,
  interactions,
  followUps,
  qualification,
  reminders,
  dayRate,
  hasPitch,
  organizations,
  outreach,
  openEmailDraft = false,
  strategy = null,
  stageEvents = [],
  deepAnalysis = null,
  hasAiKey = false,
  explanations = {},
}: CompanyDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  // Personne seule (indépendant, ou entreprise inconnue) : sa fiche tient lieu d'entreprise
  const isIndividual = company.kind === 'individual'
  // Source de l'entreprise : officielle, analyse IA ou saisie (badge sous le nom)
  const provenance = companyProvenance(company)

  const handleDelete = async () => {
    const consequence = isIndividual
      ? 'Ses coordonnées, échanges et relances seront aussi supprimés.'
      : 'Ses contacts, signaux et échanges seront aussi supprimés.'
    if (!confirm(`Supprimer ${company.name} ? ${consequence}`)) {
      return
    }

    setIsDeleting(true)
    const result = await deleteCompany(company.id)

    if (result.success) {
      toast({ title: isIndividual ? 'Personne supprimée' : 'Entreprise supprimée', description: company.name })
      router.push(isIndividual ? '/people' : '/companies')
      router.refresh()
    } else {
      setIsDeleting(false)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    }
  }

  const location = [company.postal_code, company.city].filter(Boolean).join(' ')
  const age = companyAge(company.founded_on)
  // Signaux qui comptent : prouvés et non écartés (même règle que le score)
  const countedSignals = signals.filter((signal) => !signal.invalidated_at && hasSignalProof(signal))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={isIndividual ? '/people' : '/companies'}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isIndividual ? 'Personnes' : 'Entreprises'}
          </Link>
        </Button>

        <div className="flex flex-wrap justify-end gap-2">
          {isIndividual && (
            <AttachToCompanyDialog
              individualId={company.id}
              personName={company.name}
              organizations={organizations}
            />
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/companies/${company.id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label={`Supprimer ${company.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* En-tête : qui est-ce, où en est-on, et la prochaine action */}
      <Card>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight break-words">{company.name}</h1>
                {(isIndividual || company.sector || location) && (
                  <p className="text-base text-muted-foreground mt-1">
                    {[isIndividual && individualLabel(company), company.sector, location].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <CompanyStageSelect companyId={company.id} stageId={company.stage_id} stages={stages} />
                <CompanySegmentSelect companyId={company.id} segment={company.segment} setBy={company.segment_set_by} />
              </div>
              {provenance && <ProvenanceBadge kind={provenance.kind} detail={provenance.detail} />}
              <ProspectingToggle
                companyId={company.id}
                engagedAt={company.engaged_at}
                excluded={stages.find((stage) => stage.id === company.stage_id)?.kind === 'excluded'}
              />
            </div>
            <CompatibilityTile score={company.score} />
          </div>

          <CompanyNextStep company={company} />
        </CardContent>
      </Card>

      {/* Deux colonnes sur grand écran : comprendre l'entreprise à gauche, agir à droite */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <CompanyWhyCard
            company={company}
            strategy={strategy}
            signalCount={countedSignals.length}
            signalTypes={countedSignals.map((signal) => signal.signal_type)}
            hasDecisionMaker={contacts.some((contact) => contact.is_decision_maker && !contact.opted_out_at)}
          />

          <CompanyScoreCard qualification={qualification} />

          {signals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Signaux d&apos;opportunité
                </CardTitle>
                <CardDescription>
                  Ce qui laisse penser que cette entreprise a un besoin en ce moment. Chaque signal dit s’il s’agit d’un fait
                  constaté, d’une hypothèse ou d’un besoin exprimé par l’entreprise.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {signals.map((signal) => (
                    <li
                      key={signal.id}
                      className={cn(
                        'flex items-start justify-between gap-4 rounded-lg bg-muted p-3',
                        signal.invalidated_at && 'opacity-60'
                      )}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{signal.type?.label ?? signal.signal_type}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${SIGNAL_NATURE_TONES[signalNature(signal.type?.nature)]}`}
                          >
                            {SIGNAL_NATURE_LABELS[signalNature(signal.type?.nature)]}
                          </span>
                        </div>
                        {explanations[signal.id] ? (
                          <SignalExplanationText explanation={explanations[signal.id]!} />
                        ) : (
                          <SignalSummary signal={signal} />
                        )}
                        <p className="text-xs text-muted-foreground">
                          Source : {SIGNAL_SOURCE_LABELS[signal.source] ?? SIGNAL_SOURCE_LABELS.unknown}
                          {signal.source !== 'unknown' && ` (${SIGNAL_RELIABILITY_LABELS[signalReliability(signal.type?.reliability)]})`}
                          {signal.event_at && ` · événement du ${formatDate(signal.event_at, 'd MMMM yyyy')}`}
                          {` · collecté le ${formatDate(signal.detected_at, 'd MMMM yyyy')}`}
                        </p>
                        {signal.source_url && (
                          <a
                            href={signal.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm hover:underline inline-flex items-center gap-1 break-all"
                          >
                            Voir la source
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        )}
                        {signal.invalidated_at ? (
                          <p className="text-xs font-medium">Écarté par vous : ne compte plus dans le score.</p>
                        ) : (
                          !hasSignalProof(signal) && (
                            <p className="text-xs font-medium">Sans preuve vérifiable : ne compte pas dans le score.</p>
                          )
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(signal.detected_at), { addSuffix: true, locale: fr })}
                        </span>
                        <SignalValidityButton signalId={signal.id} invalidated={!!signal.invalidated_at} />
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {!isIndividual && (
            <CompanyDeepDiveCard companyId={company.id} analysis={deepAnalysis} hasAiKey={hasAiKey} />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                {isIndividual ? 'En bref' : 'L\'entreprise'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {company.website && (
                    <InfoItem icon={<Globe className="w-5 h-5" />} label="Site web">
                      <a
                        href={toWebsiteUrl(company.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline inline-flex items-center gap-1"
                      >
                        {toWebsiteDomain(company.website)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </InfoItem>
                  )}
                  {/* Sans site, ni analyse de la stack ni recherche de contact : on aide à le retrouver */}
                  {!company.website && (
                    <InfoItem icon={<Globe className="w-5 h-5" />} label="Site web">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(
                            [company.name, company.city, 'site officiel'].filter(Boolean).join(' ')
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline inline-flex items-center gap-1"
                        >
                          Rechercher le site
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <Link href={`/companies/${company.id}/edit`} className="text-sm text-muted-foreground hover:underline">
                          Ajouter
                        </Link>
                      </span>
                    </InfoItem>
                  )}
                  {location && (
                    <InfoItem icon={<MapPin className="w-5 h-5" />} label="Adresse">
                      {location}
                    </InfoItem>
                  )}
                  {company.registration_id && (
                    <InfoItem icon={<Hash className="w-5 h-5" />} label="SIREN">
                      <a
                        href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${company.registration_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline inline-flex items-center gap-1"
                      >
                        {company.registration_id.replace(/(\d{3})(?=\d)/g, '$1 ')}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </InfoItem>
                  )}
                  {age && (
                    <InfoItem icon={<Cake className="w-5 h-5" />} label="Création">
                      {age.since} · {age.age}
                    </InfoItem>
                  )}
                  {(!isIndividual || company.revenue) && (
                    <InfoItem icon={<Euro className="w-5 h-5" />} label="Chiffre d'affaires">
                      {company.revenue && company.finances_year ? (
                        <>
                          {formatEuros(company.revenue)} en {company.finances_year}
                          <BudgetBadge revenue={company.revenue} dayRate={dayRate} />
                        </>
                      ) : (
                        <span className="text-muted-foreground font-normal">
                          Non publié{company.registration_id ? ' (comptes confidentiels ou non encore récupérés)' : ''}
                        </span>
                      )}
                    </InfoItem>
                  )}
                  {company.size_category && (
                    <InfoItem icon={<Users className="w-5 h-5" />} label="Taille">
                      {sizeCategoryLabels[company.size_category]}
                    </InfoItem>
                  )}
                  {company.source && (
                    <InfoItem icon={<Tag className="w-5 h-5" />} label="Source">
                      {company.source.name}
                    </InfoItem>
                  )}
                  {company.legal_form && (
                    <InfoItem icon={<Building2 className="w-5 h-5" />} label="Forme juridique">
                      {company.legal_form}
                    </InfoItem>
                  )}
                </dl>

                {(company.website || company.detected_stack.length > 0) && (
                  <CompanyStack company={company} />
                )}

                {company.notes && (
                  <div>
                    <p className="font-semibold mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      Notes
                    </p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{company.notes}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground border-t pt-4">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Ajoutée le {formatDate(new Date(company.created_at), 'dd MMMM yyyy')}
                    {company.origin === 'detector' && ' par Sophie'}
                    {company.origin === 'import' && ' par import'}
                  </span>
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    {company.last_interaction_at
                      ? `Dernier échange ${formatDistanceToNow(new Date(company.last_interaction_at), {
                          addSuffix: true,
                          locale: fr,
                        })}`
                      : 'Jamais contactée'}
                  </span>
                </div>

            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <CompanyContacts
            companyId={company.id}
            companyName={company.name}
            website={company.website}
            contacts={contacts}
            isIndividual={isIndividual}
            outreach={outreach}
          />

          <Card>
            <CardHeader>
              <CardTitle>Relances</CardTitle>
              <CardDescription>
                {isIndividual ? 'Les rappels liés à cette personne' : 'Les rappels liés à cette entreprise'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RemindersList reminders={reminders} totalCount={reminders.length} companyId={company.id} />
            </CardContent>
          </Card>

          <CompanyInteractions
            companyId={company.id}
            contacts={contacts}
            interactions={interactions}
            followUps={followUps}
            hasPitch={hasPitch}
            openEmailDraft={openEmailDraft}
          />

          <CompanyStageHistory events={stageEvents} />

        </div>
      </div>
    </div>
  )
}

/**
 * Stack technique du site. L'analyse est enregistrée : si une technologie de votre
 * client idéal est détectée, la base ajoute le signal « Stack technique compatible ».
 */
function CompanyStack({ company }: { company: CompanyWithRelations }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    let result: Awaited<ReturnType<typeof analyzeCompanyWebsite>>
    try {
      result = await analyzeCompanyWebsite(company.id)
    } catch {
      toast({ variant: 'destructive', title: 'Analyse impossible', description: CONNECTION_ERROR })
      return
    } finally {
      setIsAnalyzing(false)
    }

    if (!result.success) {
      toast({ variant: 'destructive', title: 'Analyse impossible', description: result.error })
      return
    }

    if (result.data?.cached) {
      toast({ title: 'Diagnostic déjà disponible', description: 'La fiche reprend la lecture des dernières 24 heures.' })
      router.refresh()
      return
    }
    const detected = result.data?.detected ?? []
    const completed = result.data?.completed ?? []
    toast({
      title: 'Analyse terminée',
      description: [
        detected.length
          ? `Technologies détectées : ${detected.map(technologyLabel).join(', ')}.`
          : 'Aucune technologie reconnue sur ce site.',
        completed.length
          ? `Fiche complétée grâce aux mentions légales : ${completed.join(', ')}.`
          : result.data?.siren
            ? null
            : 'Aucun SIREN trouvé dans les mentions légales.',
      ]
        .filter(Boolean)
        .join(' '),
    })
    router.refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="font-semibold">Diagnostic du site</p>
        {company.website && (
          <Button type="button" variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ScanSearch className="w-4 h-4 mr-2" />
            )}
            {company.stack_detected_at ? 'Analyser à nouveau' : 'Analyser le site'}
          </Button>
        )}
      </div>
      {company.website && <p className="mb-2 text-xs text-muted-foreground">
        Lancez la lecture sur le site officiel de l’entreprise si ses conditions autorisent cet usage.
      </p>}
      {company.website_audit_url && company.website_audited_at && /^https?:\/\//.test(company.website_audit_url) && (
        <p className="mb-2 text-sm">
          Page consultée en {company.website_audit_url.startsWith('https:') ? 'HTTPS' : 'HTTP'} le{' '}
          {formatDate(new Date(company.website_audited_at), 'dd MMMM yyyy à HH:mm')}.{' '}
          <a className="underline" href={company.website_audit_url} target="_blank" rel="noopener noreferrer">Voir la page source</a>
        </p>
      )}
      {company.detected_stack.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {company.detected_stack.map((tech) => (
            <Badge key={tech} variant="secondary">
              {technologyLabel(tech)}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {company.stack_detected_at
            ? 'Aucune technologie reconnue lors de la dernière analyse.'
            : 'Pas encore analysée.'}
        </p>
      )}
      {company.stack_detected_at && !company.website_audited_at && (
        <p className="text-xs text-muted-foreground mt-2">
          Analysé le {formatDate(new Date(company.stack_detected_at), 'dd MMMM yyyy')}
        </p>
      )}
    </div>
  )
}

const TILE_TONES = {
  high: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  low: 'bg-muted text-foreground ring-ink/10',
} as const

/** Score de compatibilité mis en avant dans l'en-tête de la fiche */
function CompatibilityTile({ score }: { score: number | null }) {
  const tone = score === null ? 'low' : score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
  return (
    <div
      className={`flex shrink-0 flex-col justify-center rounded-2xl px-5 py-4 ring-1 ring-inset lg:min-w-48 ${TILE_TONES[tone]}`}
    >
      <p className="text-sm font-medium opacity-80">Compatibilité</p>
      {score === null ? (
        <p className="mt-1 text-lg font-semibold">Pas encore notée</p>
      ) : (
        <p className="mt-1 font-display text-4xl font-bold tabular-nums tracking-tight">
          <Counter to={score} duration={1.2} />
          <span className="text-xl font-semibold opacity-60"> / 100</span>
        </p>
      )}
      <p className="mt-1 text-xs opacity-70">Selon vos critères de client idéal</p>
    </div>
  )
}

// Pour une offre d'emploi, l'intitulé et le contrat parlent plus que la description générique
/** Constat (le fait), piste (hypothèse) et prestation à proposer */
function SignalExplanationText({ explanation }: { explanation: SignalExplanation }) {
  return (
    <div className="space-y-1 text-sm">
      <p>
        <span className="font-medium">Constat : </span>
        {explanation.fact}
      </p>
      {explanation.lead && (
        <p className="text-muted-foreground">
          <ProvenanceBadge kind="hypothesis" className="mr-1.5" />
          <span className="font-medium">Piste pour vous : </span>
          {explanation.lead} <span className="italic">Ce besoin n’est pas confirmé.</span>
        </p>
      )}
      {explanation.service && (
        <p className="text-muted-foreground">
          <span className="font-medium">Prestation à proposer : </span>
          {explanation.service}
        </p>
      )}
    </div>
  )
}

function SignalSummary({ signal }: { signal: CompanySignalWithType }) {
  const evidence = (signal.evidence ?? {}) as Record<string, unknown>
  const title = typeof evidence.intitule === 'string' ? evidence.intitule : null

  // Trouvé par l'analyse approfondie : l'événement, ce qu'en dit la source, et la piste (hypothèse)
  if (signal.source === 'ai_research' && typeof evidence.title === 'string') {
    return (
      <div className="space-y-0.5 text-sm text-muted-foreground">
        <p className="text-foreground">
          <ProvenanceBadge kind="ai" className="mr-1.5" />
          {evidence.title}
        </p>
        {typeof evidence.summary === 'string' && evidence.summary && <p>{evidence.summary}</p>}
        {typeof evidence.relevance === 'string' && evidence.relevance && (
          <p>
            <ProvenanceBadge kind="hypothesis" className="mr-1.5" />
            <span className="font-medium">Piste, non confirmée : </span>
            {evidence.relevance}
            {typeof evidence.service === 'string' && evidence.service && ` (${evidence.service})`}
          </p>
        )}
      </div>
    )
  }

  if (title) {
    const contract = typeof evidence.type_contrat === 'string' ? evidence.type_contrat : null
    const place = typeof evidence.lieu === 'string' ? evidence.lieu : null
    return (
      <p className="text-sm text-muted-foreground">
        « {title} »{[contract, place].filter(Boolean).map((item) => ` · ${item}`)}
      </p>
    )
  }

  return signal.type?.description ? <p className="text-sm text-muted-foreground">{signal.type.description}</p> : null
}

function InfoItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="font-medium break-words">{children}</dd>
      </div>
    </div>
  )
}
