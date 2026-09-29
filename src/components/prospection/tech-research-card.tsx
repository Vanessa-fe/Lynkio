'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Code2, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { launchTechResearch } from '@/lib/actions/prospection'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { technologyLabel } from '@/lib/constants/technologies'
import { useToast } from '@/lib/hooks/use-toast'

interface TechResearchCardProps {
  techStack: string[]
  // Un passage est déjà en cours (recherche classique ou par technologie)
  isRunning: boolean
}

export function TechResearchCard({ techStack, isRunning }: TechResearchCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLaunching, setIsLaunching] = useState(false)

  const labels = techStack.map(technologyLabel)
  const techList = labels.join(' ou ')

  const handleLaunch = async () => {
    setIsLaunching(true)
    let result: Awaited<ReturnType<typeof launchTechResearch>>
    try {
      result = await launchTechResearch()
    } catch {
      toast({ variant: 'destructive', title: 'Recherche impossible', description: CONNECTION_ERROR })
      return
    } finally {
      setIsLaunching(false)
    }

    if (result.success) {
      toast({
        title: 'Recherche lancée',
        description: 'Comptez une à deux minutes : l\'IA cherche, puis Sophie vérifie chaque site.',
      })
      router.refresh()
    } else {
      toast({ variant: 'destructive', title: 'Recherche impossible', description: result.error || 'Une erreur est survenue' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-primary" aria-hidden="true" />
          Recherche par technologie
        </CardTitle>
        <CardDescription>
          L&apos;IA cherche sur le web des PME de 10 à 250 salariés dont le site est fait avec vos technologies
          (études de cas d&apos;agences, vitrines, articles). Sophie vérifie ensuite chaque site : une entreprise
          n&apos;est retenue que si la technologie est confirmée dans son code. Elle lit son SIREN dans les mentions
          légales, ajoute sa fiche officielle et son chiffre d&apos;affaires, et écarte les indépendants.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {labels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Choisissez d&apos;abord vos technologies dans{' '}
            <Link href="/settings/icp" className="underline">
              votre client idéal
            </Link>
            .
          </p>
        ) : (
          <>
            <Button onClick={handleLaunch} disabled={isLaunching || isRunning}>
              {isLaunching || isRunning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              {isRunning ? 'Recherche en cours…' : `Chercher des entreprises ${techList}`}
            </Button>
            <p className="text-xs text-muted-foreground">
              Jusqu&apos;à 10 entreprises par recherche, sans celles que vous suivez déjà. Chaque recherche utilise
              votre crédit OpenAI (quelques centimes).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
