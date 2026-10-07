import type { EmailOtpType } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirectToPath } from '@/lib/utils/redirect'

const OTP_TYPES: EmailOtpType[] = ['recovery', 'email', 'signup', 'invite', 'magiclink', 'email_change']

/**
 * Lien des e-mails Supabase (mot de passe oublié, confirmation d'inscription).
 * Le bouton du mail pointe ici, sur le domaine de Filonea, avec un jeton à usage unique :
 * contrairement au lien « code » (PKCE), il marche aussi dans un autre navigateur
 * que celui de la demande, par exemple sur téléphone.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const requested = searchParams.get('next')
  const next = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard'

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return redirectToPath(request, next)
    }
    console.error('Lien e-mail refusé :', error.message)
  }

  // Lien expiré ou déjà utilisé : on propose d'en redemander un
  const fallback = type === 'recovery' ? '/reset-password?lien=expire' : '/login?lien=expire'
  return redirectToPath(request, fallback)
}
