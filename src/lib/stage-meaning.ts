/**
 * Ce que représente une étape du pipeline, sans se fier à son nom (lot 1.8a, décision du 17/11/2026 :
 * les étapes restent personnalisables). On lit sa NATURE (en cours, signée, perdue, hors cible), son
 * RÔLE quand il est connu (proposition envoyée, sans suite…) et sa POSITION parmi les étapes en cours.
 * Sophie s'en servira pour parler d'une étape personnalisée ; le nom n'est qu'un libellé à afficher.
 */

export type StageKind = 'open' | 'won' | 'lost' | 'excluded'

export type StageRole =
  | 'to_contact'
  | 'contacted'
  | 'followed_up'
  | 'in_discussion'
  | 'meeting'
  | 'proposal'
  | 'negotiation'
  | 'not_concluded'
  | 'no_follow_up'

export type MeaningStage = {
  id: string
  name: string
  kind: StageKind
  role: string | null
  order: number
  is_default: boolean
}

// Rôles proposés dans Paramètres > Pipeline, par nature d'étape (même liste que stage_role_fits, 00071)
export const STAGE_ROLES: { value: StageRole; kind: StageKind; label: string; hint: string }[] = [
  { value: 'to_contact', kind: 'open', label: 'À contacter', hint: 'Prête à être contactée' },
  { value: 'contacted', kind: 'open', label: 'Premier contact envoyé', hint: 'La fiche y avance au premier envoi noté' },
  { value: 'followed_up', kind: 'open', label: 'Relancée', hint: 'La fiche y avance au deuxième envoi noté' },
  { value: 'in_discussion', kind: 'open', label: 'En discussion', hint: 'La fiche y avance quand une réponse est notée' },
  { value: 'meeting', kind: 'open', label: 'Rendez-vous', hint: 'La fiche y avance quand un rendez-vous est noté' },
  { value: 'proposal', kind: 'open', label: 'Proposition envoyée', hint: 'Devis ou proposition remis' },
  { value: 'negotiation', kind: 'open', label: 'Négociation', hint: 'Conditions en discussion' },
  { value: 'not_concluded', kind: 'lost', label: 'Non concrétisé', hint: 'L’entreprise a dit non' },
  { value: 'no_follow_up', kind: 'lost', label: 'Sans suite', hint: 'Pas de réponse malgré les relances' },
]

const ROLE_LABELS = Object.fromEntries(STAGE_ROLES.map((role) => [role.value, role.label])) as Record<StageRole, string>

const KIND_MEANINGS: Record<StageKind, string> = {
  open: 'démarche en cours',
  won: 'signée',
  lost: 'non concrétisée',
  excluded: 'hors cible',
}

export function rolesForKind(kind: StageKind) {
  return STAGE_ROLES.filter((role) => role.kind === kind)
}

export function isStageRole(value: unknown): value is StageRole {
  return STAGE_ROLES.some((role) => role.value === value)
}

/** Un rôle n'a de sens que pour certaines natures (même règle que la base : stage_role_fits) */
export function roleFitsKind(kind: StageKind, role: string | null): boolean {
  return role === null || STAGE_ROLES.some((candidate) => candidate.value === role && candidate.kind === kind)
}

export type StageMeaning = {
  name: string
  kind: StageKind
  role: StageRole | null
  // « Proposition envoyée », sinon la nature : « démarche en cours », « signée »…
  meaning: string
  // Étape d'arrivée des nouvelles entreprises
  isArrival: boolean
  // Position parmi les étapes en cours (1 = la première), null pour une étape close
  position: number | null
  openCount: number
  // Phrase prête à l'emploi : « Devis envoyé : proposition envoyée (étape en cours 5 sur 7) »
  summary: string
}

export function describeStage(stage: MeaningStage, stages: MeaningStage[]): StageMeaning {
  const open = stages.filter((candidate) => candidate.kind === 'open').sort((a, b) => a.order - b.order)
  const index = open.findIndex((candidate) => candidate.id === stage.id)
  const role = isStageRole(stage.role) && roleFitsKind(stage.kind, stage.role) ? stage.role : null
  const meaning = role ? ROLE_LABELS[role].toLowerCase() : KIND_MEANINGS[stage.kind]
  const position = stage.kind === 'open' && index >= 0 ? index + 1 : null

  const details = [
    position !== null ? `étape en cours ${position} sur ${open.length}` : `étape close, ${KIND_MEANINGS[stage.kind]}`,
    stage.is_default ? 'arrivée des nouvelles entreprises' : null,
  ].filter(Boolean)
  // Le nom dit déjà ce que dit le rôle : pas de répétition (« Rendez-vous : rendez-vous »)
  const sameAsName = meaning === stage.name.trim().toLowerCase()
  const summary = `${stage.name}${sameAsName ? '' : ` : ${meaning}`} (${details.join(', ')})`

  return {
    name: stage.name,
    kind: stage.kind,
    role,
    meaning,
    isArrival: stage.is_default,
    position,
    openCount: open.length,
    summary,
  }
}

/** L'étape du compte qui porte un rôle donné (« Proposition envoyée », quel que soit son nom) */
export function stageWithRole<T extends MeaningStage>(stages: T[], role: StageRole): T | null {
  return stages.find((stage) => stage.role === role && roleFitsKind(stage.kind, stage.role)) ?? null
}
