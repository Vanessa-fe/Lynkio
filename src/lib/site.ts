/** Adresse publique du site (balises de partage, plan du site, données structurées) */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://lynkio.netlify.app').replace(/\/$/, '')

/** Partie commune des balises de partage (une page qui définit `openGraph` remplace celle du layout) */
export const OPEN_GRAPH_BASE = { siteName: 'Lynkio', locale: 'fr_FR', type: 'website' } as const

/** Titre et description de la page d'accueil, repris dans les balises de partage */
export const HOME_TITLE = 'Lynkio, l’outil de prospection des développeurs web freelance'
export const HOME_DESCRIPTION =
  'Lynkio repère les entreprises qui recrutent pour leur site, publient une mission ou utilisent votre stack, les note sur 100 et prépare un premier message.'
