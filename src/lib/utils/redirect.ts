import { NextResponse } from 'next/server'

/**
 * Redirection relative (« /update-password ») : le navigateur reste sur l'adresse qu'il utilise.
 * Sur Netlify, l'URL vue par une route est celle du déploiement (« 6ac6…--lynkio.netlify.app »),
 * pas lynkio.netlify.app : une redirection absolue y enverrait la personne, sans sa session.
 */
export function redirectToPath(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } })
}
