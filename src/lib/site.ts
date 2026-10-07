const PRODUCTION_URL = 'https://lynkio.netlify.app'

/**
 * Origine (https://hôte) d'une adresse, ou null si elle est vide ou invalide.
 * Accepte une adresse sans protocole (« lynkio.netlify.app ») : une variable d'environnement
 * mal saisie ne doit ni faire échouer le build, ni casser les liens des e-mails.
 */
export function toOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).origin
  } catch {
    return null
  }
}

/** Adresse publique du site (balises de partage, plan du site, données structurées) */
export const SITE_URL = toOrigin(process.env.NEXT_PUBLIC_APP_URL) ?? PRODUCTION_URL

/** Partie commune des balises de partage (une page qui définit `openGraph` remplace celle du layout) */
export const OPEN_GRAPH_BASE = { siteName: 'Lynkio', locale: 'fr_FR', type: 'website' } as const

/** Titre et description de la page d'accueil, repris dans les balises de partage */
export const HOME_TITLE = 'Lynkio, l’outil de prospection des freelances'
export const HOME_DESCRIPTION =
  'Lynkio repère les entreprises qui recrutent, publient une mission ou correspondent à votre client idéal, les note sur 100 et prépare votre premier message.'
