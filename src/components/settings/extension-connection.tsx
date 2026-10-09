'use client'

import { useCallback, useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { AlertTriangle, CheckCircle2, Loader2, PlugZap, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { sendToExtension, type ExtensionStatus } from '@/lib/extension'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'

type State = { kind: 'checking' } | { kind: 'missing' } | { kind: 'ready'; status: ExtensionStatus }

export function ExtensionConnection({ accountEmail }: { accountEmail: string | null }) {
  const { toast } = useToast()
  const [state, setState] = useState<State>({ kind: 'checking' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async () => {
    const status = await sendToExtension<ExtensionStatus>({ type: 'ping' })
    setState(status?.installed ? { kind: 'ready', status } : { kind: 'missing' })
  }, [])

  useEffect(() => {
    // Extension installée pendant que la page est ouverte : on revérifie au retour sur l'onglet
    const timer = setTimeout(check, 0)
    window.addEventListener('focus', check)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', check)
    }
  }, [check])

  const connect = async () => {
    setError(null)
    setBusy(true)
    try {
      const supabase = createClient()
      const { data, error: invokeError } = await supabase.functions.invoke<{ tokenHash: string; email: string }>(
        'extension-connect',
        { body: {} }
      )
      if (invokeError || !data) {
        const detail =
          invokeError instanceof FunctionsHttpError
            ? ((await invokeError.context.json().catch(() => null)) as { error?: string } | null)?.error
            : null
        setError(detail ?? CONNECTION_ERROR)
        return
      }

      const result = await sendToExtension<{ ok: boolean; email?: string; error?: string }>(
        { type: 'connect', tokenHash: data.tokenHash },
        10_000
      )
      if (!result?.ok) {
        setError(result?.error ?? 'L\'extension n\'a pas répondu : rechargez-la dans chrome://extensions, puis réessayez.')
        return
      }

      toast({ title: 'Extension connectée', description: `Elle agit maintenant pour ${result.email ?? data.email}.` })
      await check()
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setError(null)
    setBusy(true)
    try {
      await sendToExtension({ type: 'disconnect' }, 10_000)
      toast({ title: 'Extension déconnectée' })
      await check()
    } finally {
      setBusy(false)
    }
  }

  if (state.kind === 'checking') {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Recherche de l&apos;extension…
        </CardContent>
      </Card>
    )
  }

  if (state.kind === 'missing') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl">Installer l&apos;extension</CardTitle>
            <Badge variant="secondary">Pas encore installée</Badge>
          </div>
          <CardDescription>
            L&apos;extension n&apos;est pas encore sur le Chrome Web Store : pour l&apos;instant, elle s&apos;installe à la
            main, dans Google Chrome.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>
              Dans le dossier de l&apos;extension, lancez <code className="rounded bg-muted px-1.5 py-0.5">npm run build</code>{' '}
              : il crée le dossier <code className="rounded bg-muted px-1.5 py-0.5">dist</code>.
            </li>
            <li>
              Ouvrez <code className="rounded bg-muted px-1.5 py-0.5">chrome://extensions</code> et activez le{' '}
              <strong>Mode développeur</strong>, en haut à droite.
            </li>
            <li>
              Cliquez sur <strong>Charger l&apos;extension non empaquetée</strong> et choisissez le dossier{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">dist</code>.
            </li>
            <li>Revenez sur cette page : elle détecte l&apos;extension toute seule.</li>
          </ol>
          <Button variant="outline" onClick={check}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Vérifier à nouveau
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { status } = state
  const otherAccount = status.connected && accountEmail && status.email && status.email !== accountEmail

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-xl">Extension Filonea</CardTitle>
          {status.connected ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Connectée</Badge>
          ) : (
            <Badge variant="secondary">Installée, pas connectée</Badge>
          )}
          <span className="text-xs text-muted-foreground">version {status.version}</span>
        </div>
        <CardDescription>
          {status.connected
            ? `Elle agit pour ${status.email}.`
            : 'Connectez-la à votre compte pour qu\'elle puisse envoyer vos prospects dans Filonea.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {otherAccount && (
          <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            L&apos;extension est connectée à un autre compte que celui-ci ({accountEmail}). Reconnectez-la pour qu&apos;elle
            agisse pour ce compte.
          </p>
        )}
        {status.connected && !otherAccount && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            Sur le profil LinkedIn d&apos;une personne, le bouton « + Filonea » apparaît en bas à droite : il l&apos;ajoute
            à vos personnes, après vérification.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {(!status.connected || otherAccount) && (
            <Button onClick={connect} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlugZap className="w-4 h-4 mr-2" />}
              Connecter l&apos;extension
            </Button>
          )}
          {status.connected && (
            <Button variant="outline" onClick={disconnect} disabled={busy}>
              Déconnecter
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
