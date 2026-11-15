'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { savePreferences } from '@/lib/actions/notifications'
import type { SophieFrequency } from '@/types/database'

type Props = { frequency: SophieFrequency; digest: boolean; email: boolean }

export function Preferences(props: Props) {
  const [status, save, pending] = useActionState(savePreferences, '')
  // Champs contrôlés : après une action, React remet le formulaire à ses valeurs de départ,
  // et le menu revenait sur « Alertes désactivées » alors que le choix était bien enregistré.
  const [frequency, setFrequency] = useState(props.frequency)
  const [digest, setDigest] = useState(props.digest)
  const [email, setEmail] = useState(props.email)
  return <form action={save} className="space-y-3 rounded-lg border bg-card p-4">
    <label className="block font-medium" htmlFor="signal-frequency">Nouveaux signaux</label>
    <select id="signal-frequency" name="frequency" value={frequency}
      onChange={(e) => setFrequency(e.target.value as SophieFrequency)} className="rounded-md border bg-background p-2">
      <option value="off">Alertes désactivées</option>
      <option value="daily">Chaque jour</option>
      <option value="weekly">Chaque lundi</option>
    </select>
    <p className="text-sm text-muted-foreground">Pour vos fiches ouvertes et les entreprises de vos recherches sauvegardées.</p>
    <label className="flex items-center gap-2">
      <input type="checkbox" name="digest" checked={digest} onChange={(e) => setDigest(e.target.checked)} />
      Recevoir le bilan des actions chaque lundi
    </label>
    <label className="flex items-center gap-2">
      <input type="checkbox" name="email" checked={email} onChange={(e) => setEmail(e.target.checked)} />
      Recevoir aussi ces alertes par e-mail
    </label>
    <p className="text-sm text-muted-foreground">Les alertes arrivent toujours dans Filonéa. Vous pouvez désactiver chaque abonnement ici.</p>
    <Button size="sm" disabled={pending}>Enregistrer mes préférences</Button>
    <p role="status" className="text-sm">{status}</p>
  </form>
}
