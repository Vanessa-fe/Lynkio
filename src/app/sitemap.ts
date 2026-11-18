import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/contact`,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    ...['/mentions-legales', '/conditions', '/confidentialite'].map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    })),
  ]
}
