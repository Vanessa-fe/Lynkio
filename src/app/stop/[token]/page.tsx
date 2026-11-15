import type { Metadata } from 'next'
import { Logo } from '@/components/brand/logo'
import { OptOutForm } from './opt-out-form'

export const metadata: Metadata = {
  title: 'Ne plus être contacté',
  robots: { index: false, follow: false },
}

/**
 * Lien « ne plus être contacté » du premier e-mail de Sophie. La personne confirme d'un clic :
 * un simple passage sur la page ne suffit pas, car les antivirus des messageries ouvrent les liens
 * tout seuls. Aucune information sur l'expéditeur ou le contact n'est affichée.
 */
export default async function OptOutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <header className="border-b border-ink/[0.07]">
        <div className="mx-auto max-w-xl px-4 py-5">
          <Logo className="text-ink" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
        <OptOutForm token={token} />
      </main>
    </div>
  )
}
