import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion - Lynkio',
  description: 'Connectez-vous à votre compte Lynkio',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
