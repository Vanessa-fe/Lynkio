import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

/** Seuls l'accueil et la page Confidentialité sont publics : l'application demande une connexion. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/auth/',
        '/dashboard',
        '/prospection',
        '/companies',
        '/people',
        '/reminders',
        '/settings',
        '/import-export',
        '/onboarding',
        '/reset-password',
        '/update-password',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
