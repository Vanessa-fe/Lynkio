'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { confirmAction } from '@/components/ui/confirm-dialog'
import { clearStyleExamples, deleteStyleExample } from '@/lib/actions/message-style'
import { STYLE_CHANNEL_LABELS, STYLE_EXAMPLES_IN_PROMPT, STYLE_EXAMPLES_PER_CHANNEL } from '@/lib/message-style'
import type { StyleExample } from '@/lib/queries/message-style'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { formatDate } from '@/lib/utils/dates'
import { useToast } from '@/lib/hooks/use-toast'

/**
 * Messages que la freelance a écrits ou réécrits elle-même : Sophie imite leur ton et leur longueur.
 * Chacun peut être oublié, ou tous d'un coup.
 */
export function StyleExamples({ examples }: { examples: StyleExample[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, action: () => Promise<{ success: boolean; error?: string }>, done: string) => {
    setBusy(key)
    try {
      const result = await action()
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Action impossible', description: result.error })
        return
      }
      toast({ title: done })
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Action impossible', description: CONNECTION_ERROR })
    } finally {
      setBusy(null)
    }
  }

  const clearAll = async () => {
    const confirmed = await confirmAction({
      title: 'Oublier tous vos messages modèles ?',
      description: 'Sophie reviendra à sa façon d’écrire, avec seulement vos consignes de style.',
      confirmLabel: 'Tout oublier',
      destructive: true,
    })
    if (confirmed) await run('all', clearStyleExamples, 'Messages modèles oubliés')
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Vos messages modèles</CardTitle>
          <CardDescription>
            Quand vous réécrivez un message de Sophie avant de l’envoyer, votre version est gardée ici. Pour chaque
            nouveau message, Sophie s’inspire de vos {STYLE_EXAMPLES_IN_PROMPT} derniers du même canal : ton, longueur,
            tournures, jamais leur contenu. {STYLE_EXAMPLES_PER_CHANNEL} au plus par canal.
          </CardDescription>
        </div>
        {examples.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll} disabled={busy !== null} className="shrink-0">
            {busy === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Tout oublier
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {examples.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun pour l’instant. Ils arrivent quand vous modifiez un message proposé par Sophie, puis cliquez sur
            « C’est envoyé » (WhatsApp), enregistrez ou copiez l’e-mail, ou validez le message LinkedIn.
          </p>
        ) : (
          examples.map((example) => (
            <div key={example.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{STYLE_CHANNEL_LABELS[example.channel]}</Badge>
                  Gardé le {formatDate(example.createdAt, "d MMMM 'à' HH'h'mm")}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => run(example.id, () => deleteStyleExample(example.id), 'Message modèle oublié')}
                  disabled={busy !== null}
                  aria-label="Oublier ce message modèle"
                >
                  {busy === example.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span className="ml-1.5 hidden sm:inline">Oublier</span>
                </Button>
              </div>
              <p className="whitespace-pre-line text-sm">{example.content}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
