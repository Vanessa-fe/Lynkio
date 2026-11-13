'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { purgeInactiveProspectsNow, saveRetentionSettings } from '@/lib/actions/data-retention'
import { INACTIVE_PROSPECT_MONTHS, LINKEDIN_POSTS_DAYS } from '@/lib/constants/data-retention'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { formatDate } from '@/lib/utils/dates'
import type { InactiveProspectMonths, LinkedinPostsRetentionDays } from '@/types/database'

type Props = {
  settings: {
    inactive_prospect_months: InactiveProspectMonths
    auto_purge_enabled: boolean
    linkedin_posts_days: LinkedinPostsRetentionDays
    last_purge_at: string | null
  }
  preview: { companies: number; contacts: number }
}

function plural(count: number, word: string) {
  return `${count} ${word}${count > 1 ? 's' : ''}`
}

export function DataRetentionSettings({ settings, preview }: Props) {
  const { toast } = useToast()
  const [months, setMonths] = useState(settings.inactive_prospect_months)
  const [autoPurge, setAutoPurge] = useState(settings.auto_purge_enabled)
  const [postsDays, setPostsDays] = useState(settings.linkedin_posts_days)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [isPurging, setIsPurging] = useState(false)

  const isDirty =
    months !== settings.inactive_prospect_months ||
    autoPurge !== settings.auto_purge_enabled ||
    postsDays !== settings.linkedin_posts_days
  // L'aperçu est calculé côté serveur avec la durée enregistrée
  const previewIsCurrent = months === settings.inactive_prospect_months

  const save = async () => {
    setIsSaving(true)
    try {
      const result = await saveRetentionSettings({
        inactiveProspectMonths: months,
        autoPurgeEnabled: autoPurge,
        linkedinPostsDays: postsDays,
      })
      toast(result.success ? { title: result.message } : { title: result.error, variant: 'destructive' })
    } catch {
      toast({ title: CONNECTION_ERROR, variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const purge = async () => {
    setIsPurging(true)
    try {
      const result = await purgeInactiveProspectsNow()
      toast(result.success ? { title: result.message } : { title: result.error, variant: 'destructive' })
      setConfirmPurge(false)
    } catch {
      toast({ title: CONNECTION_ERROR, variant: 'destructive' })
    } finally {
      setIsPurging(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Durée de conservation</CardTitle>
        <CardDescription>
          Le RGPD demande de ne pas garder indéfiniment les données de prospects restés sans suite. Choisissez la durée ;
          vos clients, les fiches avec un échange ou un rappel récent et les personnes qui ont demandé à ne plus être
          contactées sont toujours gardés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="retention-months">Garder un prospect sans suite</Label>
            <Select value={String(months)} onValueChange={(value) => setMonths(Number(value) as InactiveProspectMonths)}>
              <SelectTrigger id="retention-months">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INACTIVE_PROSPECT_MONTHS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Compté depuis le dernier échange, signal ou ajout.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="retention-posts">Garder les posts LinkedIn non retenus</Label>
            <Select
              value={String(postsDays)}
              onValueChange={(value) => setPostsDays(Number(value) as LinkedinPostsRetentionDays)}
            >
              <SelectTrigger id="retention-posts">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINKEDIN_POSTS_DAYS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Les posts ajoutés à vos prospects restent.</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="retention-auto"
            checked={autoPurge}
            onCheckedChange={(checked) => setAutoPurge(checked === true)}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label htmlFor="retention-auto">Effacer automatiquement chaque nuit les prospects sans suite</Label>
            <p className="text-sm text-muted-foreground">
              {previewIsCurrent
                ? preview.companies > 0
                  ? `Aujourd'hui, cela effacerait ${plural(preview.companies, 'entreprise')} et ${plural(preview.contacts, 'contact')}.`
                  : "Aujourd'hui, rien ne serait effacé."
                : 'Enregistrez pour voir ce que cette durée effacerait.'}
              {settings.last_purge_at && ` Dernier nettoyage : ${formatDate(settings.last_purge_at, "d MMMM yyyy 'à' HH:mm")}.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!isDirty || isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
          {settings.auto_purge_enabled && !isDirty && preview.companies > 0 && !confirmPurge && (
            <Button variant="outline" onClick={() => setConfirmPurge(true)}>
              Nettoyer maintenant
            </Button>
          )}
        </div>

        {confirmPurge && (
          <div className="rounded-md border border-destructive/40 p-4 space-y-3">
            <p className="text-sm">
              {plural(preview.companies, 'entreprise')} et {plural(preview.contacts, 'contact')} vont être effacés
              définitivement, avec leurs notes et signaux. Pensez à exporter vos données avant si besoin.
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={purge} disabled={isPurging}>
                {isPurging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Effacer définitivement
              </Button>
              <Button variant="ghost" onClick={() => setConfirmPurge(false)} disabled={isPurging}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
