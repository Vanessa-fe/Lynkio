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
}

module.exports = nextConfig
