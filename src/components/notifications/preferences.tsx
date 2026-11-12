'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { savePreferences } from '@/lib/actions/notifications'
import type { SophieFrequency } from '@/types/database'

export function Preferences({ frequency, digest }: { frequency: SophieFrequency; digest: boolean }) {
  const [status, save, pending] = useActionState(savePreferences, '')
  return <form action={save} className="space-y-3 rounded-lg border bg-card p-4">
    <label className="block font-medium" htmlFor="signal-frequency">Nouveaux signaux</label>
    <select id="signal-frequency" name="frequency" defaultValue={frequency} className="rounded-md border bg-background p-2">
      <option value="off">Alertes désactivées</option>
      <option value="daily">Chaque jour</option>
      <option value="weekly">Chaque lundi</option>
    </select>
    <p className="text-sm text-muted-foreground">Pour vos fiches ouvertes et les entreprises de vos recherches sauvegardées.</p>
    <label className="flex items-center gap-2"><input type="checkbox" name="digest" defaultChecked={digest} />Recevoir le bilan des actions chaque lundi</label>
    <p className="text-sm text-muted-foreground">Ces notifications arrivent dans Filonéa. Vous pouvez désactiver chaque abonnement ici.</p>
    <Button size="sm" disabled={pending}>Enregistrer mes préférences</Button>
    <p role="status" className="text-sm">{status}</p>
  </form>
}
