import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'

/**
 * Client Supabase pour le middleware
 * Gère le rafraîchissement automatique de la session
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([name, value]) =>
            supabaseResponse.headers.set(name, value)
          )
        },
      },
    }
  )

  // IMPORTANT : aucune logique entre createServerClient et getClaims().
  // getClaims() rafraîchit la session si besoin, puis vérifie le jeton avec la clé
  // publique du projet (ES256), sans appel réseau à chaque page (contrairement à getUser()).
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims ?? null

  // Compatibilité avec les anciens emails de récupération qui pointaient
  // directement vers une route inexistante.
  if (
    request.nextUrl.pathname === '/login' &&
    request.nextUrl.searchParams.has('code') &&
    request.nextUrl.searchParams.get('redirect') === '/auth/update-password'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    url.searchParams.set('next', '/update-password')
    url.searchParams.delete('redirect')
    return NextResponse.redirect(url)
  }

  // Routes publiques
  const authRoutes = ['/login', '/signup', '/reset-password']
  const isAuthRoute = authRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )
  const isAuthCallback = request.nextUrl.pathname === '/auth/callback'
  const isPublicRoute = isAuthRoute || isAuthCallback

  // Redirection si non authentifié et accès à une route protégée
  if (!user && !isPublicRoute && request.nextUrl.pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Redirection si authentifié et accès à une route publique
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
