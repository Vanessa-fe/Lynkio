// Projet Supabase : API, connexion, fonctions et fichiers
const SUPABASE_ORIGIN = 'https://kifzcqxasqpcstujihqt.supabase.co'

// Règles de sécurité envoyées avec chaque page. La politique de contenu (CSP) limite ce que la page
// peut charger ou contacter : même si un texte malveillant s'y glissait, il ne pourrait ni charger un
// script d'un autre site, ni envoyer des données ailleurs qu'à Filonea et Supabase. PostHog passe par
// filonea.fr/ingest. 'unsafe-inline' reste nécessaire pour les petits scripts que Next.js écrit dans la page.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} wss://kifzcqxasqpcstujihqt.supabase.co`,
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  // Le site ne peut pas être affiché dans un cadre d'un autre site (anciens navigateurs)
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Le mode développement de Next.js a besoin d'eval : les règles ne s'appliquent qu'en ligne
  async headers() {
    if (process.env.NODE_ENV !== 'production') return []
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  poweredByHeader: false,
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
