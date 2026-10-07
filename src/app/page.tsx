import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/auth'
import { LandingPage } from '@/components/landing/landing-page'
import { brand, faqItems, features } from '@/components/landing/content'
import { HOME_DESCRIPTION, HOME_TITLE, OPEN_GRAPH_BASE, SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
}

/**
 * Données structurées : disent aux moteurs et aux IA ce qu'est Lynkio (le site, le logiciel)
 * et reprennent mot pour mot les questions fréquentes affichées sur la page.
 */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#site`,
      url: SITE_URL,
      name: brand.name,
      inLanguage: 'fr-FR',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#app`,
      name: brand.name,
      url: SITE_URL,
      description: brand.definition,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: brand.category,
      operatingSystem: 'Web',
      inLanguage: 'fr-FR',
      audience: {
        '@type': 'Audience',
        audienceType: 'Freelances qui vendent leurs services aux entreprises',
        geographicArea: { '@type': 'Country', name: 'France' },
      },
      featureList: Object.values(features).map((feature) => feature.title),
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#questions`,
      isPartOf: { '@id': `${SITE_URL}/#site` },
      about: { '@id': `${SITE_URL}/#app` },
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ],
}

export default async function HomePage() {
  // Déjà connecté·e : on va droit à l'application. Sinon, la présentation de l'outil.
  if (await getAuthUser()) {
    redirect('/dashboard')
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <LandingPage />
    </>
  )
}
