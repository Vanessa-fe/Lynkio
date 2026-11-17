/**
 * Assistant « Simplifier mon pipeline » (lot 1.11, §4.2-E de la refonte) : ce qu'on peut proposer à un
 * compte créé avec les anciennes étapes. Rien n'est fait sans clic : cette fonction ne fait que calculer
 * l'aperçu ; la fonction SQL simplify_pipeline revérifie chaque condition au moment d'appliquer.
 *
 * Les étapes sont reconnues par leur nature et leur rôle (jamais par leur seul nom), sauf les deux
 * renommages, qui ne touchent que les noms d'origine exacts (« Gagné », « Perdu ») : un nom choisi par
 * l'utilisateur reste le sien.
 */

export type SimplifyStage = {
  id: string
  name: string
  kind: string
  role: string | null
  is_default: boolean
  order: number
}

export type SimplifyStepId = 'arrival' | 'followed_up' | 'negotiation' | 'rename'

export type SimplifyStep = {
  id: SimplifyStepId
  title: string
  detail: string
}

export type SimplifyPlan = {
  steps: SimplifyStep[]
  before: SimplifyStage[]
  // Étapes après application de toutes les propositions (aperçu)
  after: { name: string; kind: string; isDefault: boolean; isNew: boolean; renamedFrom: string | null }[]
}

export const NEGOTIATION_NAME = 'Négociation'
export const RENAMES: { kind: string; role: string | null; from: string; to: string }[] = [
  { kind: 'won', role: null, from: 'Gagné', to: 'Signé' },
  { kind: 'lost', role: 'not_concluded', from: 'Perdu', to: 'Non concrétisé' },
]

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

function companiesText(count: number) {
  return plural(count, 'entreprise', 'entreprises')
}

export function planPipelineSimplification(
  stages: SimplifyStage[],
  usage: Record<string, number>,
  // Propositions retenues pour l'aperçu « après » (toutes par défaut)
  only?: Set<SimplifyStepId>
): SimplifyPlan {
  const keep = (id: SimplifyStepId) => !only || only.has(id)
  const sorted = [...stages].sort((a, b) => a.order - b.order)
  const byRole = (role: string) => sorted.find((stage) => stage.role === role)
  const names = new Set(sorted.map((stage) => stage.name))
  const steps: SimplifyStep[] = []

  // 1. L'étape d'arrivée sans rôle (« À qualifier ») cède la place à l'étape « à contacter »
  const arrival = sorted.find((stage) => stage.is_default)
  const toContact = byRole('to_contact')
  const removeArrival = !!arrival && !!toContact && arrival.id !== toContact.id && arrival.role === null && arrival.kind === 'open'
  if (removeArrival) {
    const count = usage[arrival.id] ?? 0
    steps.push({
      id: 'arrival',
      title: `Retirer « ${arrival.name} »`,
      detail:
        `Les nouvelles entreprises arriveront dans « ${toContact.name} ». ` +
        (count > 0
          ? `Les ${companiesText(count)} de « ${arrival.name} » y passent aussi, sans entrer dans votre suivi : celles que vous n’avez pas commencé à prospecter restent des découvertes.`
          : `L’étape est vide.`),
    })
  }

  // 2. « Relancé » : la relance se lit désormais dans les échanges (« Relance n° 2 »), plus dans une étape
  const followedUp = byRole('followed_up')
  const contacted = byRole('contacted')
  const removeFollowedUp = !!followedUp && !!contacted && !followedUp.is_default
  if (removeFollowedUp) {
    const count = usage[followedUp.id] ?? 0
    steps.push({
      id: 'followed_up',
      title: `Retirer « ${followedUp.name} »`,
      detail:
        `Vos relances restent comptées et visibles dans les échanges de chaque fiche (« Relance n° 2 »). ` +
        (count > 0 ? `Les ${companiesText(count)} de cette étape passent dans « ${contacted.name} ».` : `L’étape est vide.`),
    })
  }

  // 3. Une étape « Négociation » entre la proposition et la signature
  const addNegotiation = !byRole('negotiation') && !names.has(NEGOTIATION_NAME)
  const proposal = byRole('proposal')
  if (addNegotiation) {
    steps.push({
      id: 'negotiation',
      title: `Ajouter « ${NEGOTIATION_NAME} »`,
      detail: proposal
        ? `Nouvelle étape juste après « ${proposal.name} », pour les propositions en cours de discussion.`
        : `Nouvelle étape après vos étapes en cours, pour les propositions en cours de discussion.`,
    })
  }

  // 4. Libellés « Signé » et « Non concrétisé », seulement pour les noms d'origine
  const renames = RENAMES.flatMap((rename) => {
    const stage = sorted.find((item) => item.kind === rename.kind && item.role === rename.role && item.name === rename.from)
    return stage && !names.has(rename.to) ? [{ stage, to: rename.to }] : []
  })
  if (renames.length > 0) {
    steps.push({
      id: 'rename',
      title: 'Renommer les résultats',
      detail: `${renames.map((rename) => `« ${rename.stage.name} » devient « ${rename.to} »`).join(', ')}. Les entreprises et les statistiques ne changent pas.`,
    })
  }

  // Aperçu « après » avec les propositions retenues
  const applyArrival = removeArrival && keep('arrival')
  const applyFollowedUp = removeFollowedUp && keep('followed_up')
  const applyNegotiation = addNegotiation && keep('negotiation')
  const applyRenames = keep('rename') ? renames : []
  const after: SimplifyPlan['after'] = []
  const negotiationAnchor = proposal ?? [...sorted].reverse().find((stage) => stage.kind === 'open')
  for (const stage of sorted) {
    if (applyArrival && stage.id === arrival!.id) continue
    if (applyFollowedUp && stage.id === followedUp!.id) continue
    const rename = applyRenames.find((item) => item.stage.id === stage.id)
    after.push({
      name: rename ? rename.to : stage.name,
      kind: stage.kind,
      isDefault: applyArrival ? stage.id === toContact!.id : stage.is_default,
      isNew: false,
      renamedFrom: rename ? stage.name : null,
    })
    if (applyNegotiation && negotiationAnchor && stage.id === negotiationAnchor.id) {
      after.push({ name: NEGOTIATION_NAME, kind: 'open', isDefault: false, isNew: true, renamedFrom: null })
    }
  }

  return { steps, before: sorted, after }
}
