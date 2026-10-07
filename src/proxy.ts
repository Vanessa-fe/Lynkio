import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Adresses secondaires renvoyées vers filonea.fr (même chemin, mêmes paramètres). Fait ici plutôt que
// dans netlify.toml : sur Netlify, ce contrôle passe avant les règles de redirection.
const SECONDARY_HOSTS = new Set(['filonea.com', 'www.filonea.com', 'lynkio.netlify.app'])

export async function proxy(request: NextRequest) {
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.hostname)
    .split(',')[0]!
    .trim()
    .split(':')[0]!
  if (SECONDARY_HOSTS.has(host)) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, 'https://filonea.fr')
    return NextResponse.redirect(target, 301)
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt, sitemap.xml, opengraph-image (lus par les moteurs sans être connectés)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
