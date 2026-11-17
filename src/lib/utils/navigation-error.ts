import { unstable_rethrow } from 'next/navigation'

/**
 * Une action serveur qui finit par `redirect()` ne « réussit » pas côté navigateur : Next.js rejette
 * volontairement sa promesse avec une erreur de navigation, pendant qu'il ouvre la nouvelle page
 * (voir server-action-reducer de Next.js). Un `catch` qui affiche « Une erreur est survenue » prendrait
 * donc une connexion réussie pour un échec.
 *
 * Renvoie true pour ces erreurs de navigation (redirection, page introuvable…) : le formulaire n'affiche
 * rien, la page suivante arrive. `unstable_rethrow` est la façon publique de les reconnaître.
 */
export function isNavigationError(error: unknown): boolean {
  try {
    unstable_rethrow(error)
    return false
  } catch {
    return true
  }
}
