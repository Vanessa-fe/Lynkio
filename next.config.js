/** @type {import('next').NextConfig} */
const nextConfig = {
  // En développement, Next.js bloque les autres adresses que localhost : 127.0.0.1 sert à voir
  // le site en visiteur (sans les cookies de connexion de localhost)
  allowedDevOrigins: ['127.0.0.1'],
  experimental: {
    // Le cache disque de Turbopack enregistre les valeurs des variables d'environnement lues
    // (dont BREVO_API_KEY) : le scan de secrets de Netlify le détecte et bloque le déploiement
    // (vu sur Solynk avec sa clé Resend, le 2026-09-30)
    turbopackFileSystemCacheForBuild: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // Statistiques PostHog (région Europe) envoyées via filonea.fr/ingest plutôt qu'au domaine de
  // PostHog, que les bloqueurs de publicité arrêtent souvent. En ligne, c'est netlify.toml qui relaie
  // (ces réécritures abîment les envois compressés sur Netlify) : celles-ci servent en local.
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/array/:path*',
        destination: 'https://eu-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
    ]
  },
  // Les adresses d'envoi de PostHog finissent par « / » : sans ce réglage, Next.js les redirige
  skipTrailingSlashRedirect: true,
}

module.exports = nextConfig
