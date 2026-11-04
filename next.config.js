/** @type {import('next').NextConfig} */
const nextConfig = {
  // En développement, Next.js bloque les autres adresses que localhost : 127.0.0.1 sert à voir
  // le site en visiteur (sans les cookies de connexion de localhost)
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // Statistiques PostHog (région Europe) envoyées via filonea.fr/ingest plutôt qu'au domaine de
  // PostHog, que les bloqueurs de publicité arrêtent souvent
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
