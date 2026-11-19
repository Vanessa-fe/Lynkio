// Lecture d'une page publique (page d'accueil d'un site), sans lever d'erreur.

import { publicPage } from '../_shared/public-page.ts'

export async function fetchPublicPage(rawUrl: string) {
  try { return await publicPage(rawUrl) } catch { return null }
}
