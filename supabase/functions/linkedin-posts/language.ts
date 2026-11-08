// Langue des posts : seules les annonces écrites en français sont gardées (LinkedIn ne propose
// pas de filtre de langue sur la recherche de posts).
//
// Le code écarte d'abord les posts nettement en anglais, sans dépenser d'IA : il compte les mots
// courants propres à chaque langue. Pour le reste, l'IA donne la langue principale du post.

// Mots fréquents qui n'existent (presque) que dans une des deux langues
const FRENCH_WORDS = new Set([
  'le', 'la', 'les', 'des', 'une', 'est', 'pour', 'nous', 'vous', 'je', 'avec', 'dans', 'sur', 'pas',
  'qui', 'que', 'du', 'au', 'aux', 'ce', 'cette', 'mais', 'très', 'être', 'sont', 'chez', 'notre', 'nos', 'votre',
])
const ENGLISH_WORDS = new Set([
  'the', 'and', 'is', 'are', 'for', 'we', 'you', 'with', 'looking', 'our', 'this', 'that', 'to', 'of',
  'hiring', 'will', 'be', 'your', 'have', 'who', 'from', 'about',
])

// Pour dire « Post en espagnol » plutôt qu'un code
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
  it: 'italien',
  pt: 'portugais',
  nl: 'néerlandais',
  ar: 'arabe',
}

/** Le post est nettement en anglais : beaucoup de mots anglais courants, presque pas de français */
export function clearlyEnglish(text: string): boolean {
  let french = 0
  let english = 0
  for (const word of text.toLowerCase().match(/[a-zàâäçéèêëîïôöùûüœ']+/g) ?? []) {
    if (FRENCH_WORDS.has(word)) french++
    else if (ENGLISH_WORDS.has(word)) english++
  }
  return english >= 5 && english > french * 3
}

export function notFrenchReason(language: string): string {
  const name = LANGUAGE_NAMES[language]
  return `Post ${name ? `en ${name}` : 'dans une autre langue'} : seules les annonces en français sont gardées`
}
