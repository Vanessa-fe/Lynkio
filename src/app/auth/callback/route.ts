import { createClient } from '@/lib/supabase/server'
import { redirectToPath } from '@/lib/utils/redirect'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const requestedDestination = requestUrl.searchParams.get('next')
  const destination =
    requestedDestination?.startsWith('/') && !requestedDestination.startsWith('//')
      ? requestedDestination
      : '/onboarding'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Error exchanging code for session:', error)
      // Lien expiré, déjà utilisé ou ouvert dans un autre navigateur : on propose d'en redemander un
      const fallback = destination === '/update-password' ? '/reset-password?lien=expire' : '/login?lien=expire'
      return redirectToPath(fallback)
    }
  }

  return redirectToPath(destination)
}
