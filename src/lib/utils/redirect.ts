import { NextResponse } from 'next/server'

/**
 * Redirection vers une page du site, sur l'adresse qu'utilise le navigateur.
 * Sur Netlify, l'URL vue par une route est celle du déploiement (« 6ac6…--lynkio.netlify.app »),
 * pas lynkio.netlify.app : on part donc de l'hôte transmis par le proxy, sinon d'un chemin relatif.
 * Sans cela, la personne arriverait sur une autre adresse, sans sa session.
 */
export function redirectToPath(request: Request, path: string) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const location = host ? `${proto.split(',')[0]?.trim() || 'https'}://${host}${path}` : path
  return new NextResponse(null, { status: 307, headers: { Location: location } })
}
