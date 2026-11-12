'use client'

import { useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { CONNECTION_ERROR } from '@/lib/constants/errors'

/**
 * Reformulation facultative du bilan avec la clé IA de l'utilisateur (fonction sophie-digest).
 * Appel direct depuis le navigateur : l'IA prend souvent plus que le temps accordé à une action serveur.
 */
export function DigestRewrite({ id }: { id: string }) {
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const rewrite = async () => {
    setPending(true)
    setError(null)
    try {
      const { data, error: invokeError } = await createClient().functions.invoke<{ summary: string }>('sophie-digest', {
        body: { id },
      })
      if (invokeError || !data?.summary) {
        const detail =
          invokeError instanceof FunctionsHttpError
            ? ((await invokeError.context.json().catch(() => null)) as { error?: string } | null)?.error
            : null
        setError(detail ?? CONNECTION_ERROR)
        return
      }
      setSummary(data.summary)
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-2 space-y-1">
      <Button type="button" size="sm" variant="outline" onClick={rewrite} disabled={pending || !!summary}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {pending ? 'Reformulation…' : 'Reformuler avec ma clé IA'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Facultatif. Seuls les totaux et la période sont envoyés à votre fournisseur d’IA, selon son tarif.
      </p>
      {summary && <p className="rounded-md bg-muted p-3 text-sm">{summary}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
