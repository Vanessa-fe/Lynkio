import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter, Sora } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { MotionProvider } from '@/components/motion/motion-provider'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const sora = Sora({ subsets: ['latin'], variable: '--font-display' })
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  style: ['italic'],
  weight: ['500'],
})

export const metadata: Metadata = {
  title: 'Lynkio',
  description: 'L\'outil de prospection des freelances : Sophie repère les entreprises qui ont besoin de vous et prépare vos messages.',
}

export const viewport: Viewport = {
  themeColor: '#fdfaf7',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${sora.variable} ${fraunces.variable}`}>
      <body className="font-sans">
        <MotionProvider>
          {children}
          <Toaster />
        </MotionProvider>
      </body>
    </html>
  )
}
