/**
 * Entonnoir de conversion (carte Trello « Ajouter tableaux de bord data-driven et entonnoir »).
 *
 * Méthode : une COHORTE = les fiches ajoutées pendant la période choisie (filtres recherche, source,
 * secteur). Pour chaque fiche, on retient l'étape la plus avancée qu'elle a atteinte, d'après :
 *   - son étape actuelle et l'historique des étapes (company_stage_events) ;
 *   - ses échanges notés : un envoi = contactée, une réponse reçue = réponse, un rendez-vous = RDV.
 * Une fiche qui a atteint une étape compte aussi pour toutes les étapes d'avant.
 * Chaque taux affiche son dénominateur (« 3 sur 12 ») ; sans dénominateur, pas de taux (« — »).
 * On ne déduit aucune cause : l'entonnoir dit ce qui s'est passé, pas pourquoi.
 */

export const FUNNEL_STEPS = [
  { key: 'found', label: 'Trouvées', hint: 'ajoutées pendant la période' },
  { key: 'qualified', label: 'Qualifiées', hint: 'sorties de « À qualifier » (hors « Hors cible »)' },
  { key: 'contacted', label: 'Contactées', hint: 'au moins un envoi noté' },
  { key: 'replied', label: 'Réponses', hint: 'au moins une réponse reçue notée' },
  { key: 'meeting', label: 'Rendez-vous', hint: 'un rendez-vous noté' },
  { key: 'proposal', label: 'Propositions', hint: 'passées à « Proposition envoyée »' },
  { key: 'won', label: 'Gagnées', hint: 'passées à une étape « gagnée »' },
] as const

export type FunnelStepKey = (typeof FUNNEL_STEPS)[number]['key']

// Périodes proposées (filtre « Période » de la page Résultats)
export const FUNNEL_PERIODS = [
  { value: '30', label: '30 derniers jours', days: 30 },
  { value: '90', label: '3 derniers mois', days: 90 },
  { value: '365', label: '12 derniers mois', days: 365 },
  { value: 'all', label: 'Depuis le début', days: null },
] as const

// En dessous, un taux ne permet pas de conclure (signalé à l'écran)
export const SMALL_SAMPLE = 30

export type FunnelStage = { id: string; name: string; kind: string; role: string | null; order: number; is_default: boolean }
export type FunnelCompany = { id: string; stage_id: string | null }
export type FunnelInteraction = { company_id: string; type: string; direction: string | null; status: string }
export type FunnelEvent = { company_id: string; to_stage_id: string | null }

export type FunnelResult = {
  steps: { key: FunnelStepKey; label: string; hint: string; count: number }[]
  // Taux d'une étape à la suivante : null quand le dénominateur est 0 (pas de donnée, pas « 0 % »)
  rates: { from: FunnelStepKey; to: FunnelStepKey; numerator: number; denominator: number; rate: number | null; small: boolean }[]
  excluded: number
  lost: number
}

const ROLE_STEP: Record<string, number> = { to_contact: 1, contacted: 2, followed_up: 2, in_discussion: 3, meeting: 4 }

/**
 * Étape de l'entonnoir atteinte en étant dans chaque étape du pipeline. Étapes sans rôle : celle de
 * l'étape à rôle qui la précède (dans l'ordre du pipeline) ; « Proposition… » = 5 ; gagnée = 6 ;
 * perdue / hors cible / étape par défaut : 0 (elles ne font pas avancer).
 */
export function stageSteps(stages: FunnelStage[]): Map<string, number> {
  const map = new Map<string, number>()
  let carried = 0
  for (const stage of [...stages].sort((a, b) => a.order - b.order)) {
    let step: number
    if (stage.kind === 'won') step = 6
    else if (stage.kind !== 'open' || stage.is_default) step = 0
    else if (stage.role && ROLE_STEP[stage.role] !== undefined) step = ROLE_STEP[stage.role]!
    else if (/^proposition/i.test(stage.name.trim())) step = 5
    else step = Math.max(carried, 1)
    if (stage.kind === 'open' && !stage.is_default) carried = Math.max(carried, step)
    map.set(stage.id, step)
  }
  return map
}

function interactionStep(interaction: FunnelInteraction): number {
  if (interaction.status !== 'done') return 0
  if (interaction.type === 'meeting') return 4
  if (interaction.type === 'note' || interaction.type === 'system_event') return 0
  if (interaction.direction === 'incoming') return 3
  if (interaction.direction === 'outgoing') return 2
  return 0
}

export function computeFunnel(input: {
  companies: FunnelCompany[]
  stages: FunnelStage[]
  events: FunnelEvent[]
  interactions: FunnelInteraction[]
}): FunnelResult {
  const steps = stageSteps(input.stages)
  const kindOf = new Map(input.stages.map((stage) => [stage.id, stage.kind]))
  const cohort = new Set(input.companies.map((company) => company.id))
  const reached = new Map<string, number>(input.companies.map((company) => [company.id, 0]))
  const bump = (companyId: string, step: number) => {
    if (!cohort.has(companyId)) return
    reached.set(companyId, Math.max(reached.get(companyId) ?? 0, step))
  }

  for (const company of input.companies) if (company.stage_id) bump(company.id, steps.get(company.stage_id) ?? 0)
  for (const event of input.events) if (event.to_stage_id) bump(event.company_id, steps.get(event.to_stage_id) ?? 0)
  for (const interaction of input.interactions) bump(interaction.company_id, interactionStep(interaction))

  // « Qualifiée » : sortie de l'étape par défaut sans être mise « Hors cible »
  const excludedIds = new Set(
    input.companies.filter((company) => company.stage_id && kindOf.get(company.stage_id) === 'excluded').map((company) => company.id)
  )
  const lost = input.companies.filter((company) => company.stage_id && kindOf.get(company.stage_id) === 'lost').length

  const counts = FUNNEL_STEPS.map((_, index) =>
    index === 0
      ? input.companies.length
      : [...reached.entries()].filter(([id, step]) => step >= index && !(index === 1 && excludedIds.has(id) && step < 2)).length
  )

  return {
    steps: FUNNEL_STEPS.map((step, index) => ({ ...step, count: counts[index]! })),
    rates: FUNNEL_STEPS.slice(1).map((step, index) => {
      const denominator = counts[index]!
      const numerator = counts[index + 1]!
      return {
        from: FUNNEL_STEPS[index]!.key,
        to: step.key,
        numerator,
        denominator,
        rate: denominator > 0 ? Math.round((numerator / denominator) * 100) : null,
        small: denominator > 0 && denominator < SMALL_SAMPLE,
      }
    }),
    excluded: excludedIds.size,
    lost,
  }
}
