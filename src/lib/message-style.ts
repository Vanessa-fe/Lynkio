/**
 * Style des messages : Sophie apprend des messages que la freelance écrit ou réécrit elle-même
 * (migration 00091). Un message envoyé presque tel que Sophie l'a rédigé ne dit rien du style de la
 * freelance : seul un texte vraiment à elle devient un exemple. Fichier sans dépendance (tests, navigateur).
 */

export const STYLE_CHANNELS = ['email', 'linkedin_message', 'whatsapp'] as const
export type StyleChannel = (typeof STYLE_CHANNELS)[number]

export const STYLE_CHANNEL_LABELS: Record<StyleChannel, string> = {
  email: 'E-mail',
  linkedin_message: 'LinkedIn',
  whatsapp: 'WhatsApp',
}

// Consignes permanentes (Réglages > Messages)
export const MESSAGE_STYLE_MAX_LENGTH = 1000
// Exemples gardés par canal, et donnés à Sophie à chaque rédaction
export const STYLE_EXAMPLES_PER_CHANNEL = 5
export const STYLE_EXAMPLES_IN_PROMPT = 3
// Trop court pour dire quelque chose d'un style
export const MIN_EXAMPLE_LENGTH = 40
export const MAX_EXAMPLE_LENGTH = 3000
// Au-dessus, deux textes sont « le même » (quelques mots changés)
export const SAME_TEXT_RATIO = 0.85

// Mots comparés au plus par texte (comparaison mot à mot, coût proportionnel au carré)
const MAX_WORDS = 600

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, MAX_WORDS)
}

/**
 * Ressemblance de deux textes, de 0 (rien en commun) à 1 (mêmes mots dans le même ordre) :
 * mots communs dans l'ordre (plus longue sous-suite commune), rapportés à la longueur des deux.
 */
export function textSimilarity(a: string, b: string): number {
  const left = words(a)
  const right = words(b)
  if (left.length === 0 && right.length === 0) return 1
  if (left.length === 0 || right.length === 0) return 0
  let previous = new Array<number>(right.length + 1).fill(0)
  for (const word of left) {
    const row = new Array<number>(right.length + 1).fill(0)
    for (let j = 1; j <= right.length; j++) {
      row[j] = word === right[j - 1] ? previous[j - 1]! + 1 : Math.max(previous[j]!, row[j - 1]!)
    }
    previous = row
  }
  return (2 * previous[right.length]!) / (left.length + right.length)
}

export function isSameText(a: string, b: string): boolean {
  return textSimilarity(a, b) >= SAME_TEXT_RATIO
}

// Phrases ajoutées par Filonea au premier e-mail (origine de l'adresse, désinscription) : pas du style
const ADDED_LINES = /ne plus recevoir de message de ma part|j'ai trouvé votre adresse|\/stop\/[a-z0-9_-]+/i

/** Texte gardé comme exemple : sans les mentions ajoutées par Filonea, espaces nettoyés */
export function cleanExample(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !ADDED_LINES.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_EXAMPLE_LENGTH)
}

/**
 * Faut-il garder ce message comme exemple du style de la freelance ?
 * Non s'il est trop court, s'il n'a presque pas changé depuis la version précédente (previous),
 * s'il ressemble à un brouillon de Sophie (accepté tel quel) ou à un exemple déjà gardé.
 */
export function isWrittenByHer(
  text: string,
  { previous, sophieDrafts, examples }: { previous?: string | null; sophieDrafts: string[]; examples: string[] }
): boolean {
  const cleaned = cleanExample(text)
  if (cleaned.length < MIN_EXAMPLE_LENGTH) return false
  if (previous && isSameText(previous, cleaned)) return false
  if (sophieDrafts.some((draft) => isSameText(draft, cleaned))) return false
  if (examples.some((example) => isSameText(example, cleaned))) return false
  return true
}
