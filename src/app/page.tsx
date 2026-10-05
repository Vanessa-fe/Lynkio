import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/auth'
import { LandingPage } from '@/components/landing/landing-page'

export const metadata: Metadata = {
  title: 'Lynkio : trouvez les entreprises qui ont besoin d\'un freelance',
  description:
    'Sophie repère les entreprises qui recrutent pour leur site, publient une mission ou utilisent votre technologie, les note selon votre client idéal et prépare votre premier message.',
}

export default async function HomePage() {
  // Déjà connecté·e : on va droit à l'application. Sinon, la présentation de l'outil.
  if (await getAuthUser()) {
    redirect('/dashboard')
  }

  return <LandingPage />
}
