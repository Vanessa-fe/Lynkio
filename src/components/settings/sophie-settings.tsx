'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { saveSophieSettings } from '@/lib/actions/user-profile'
import { SOPHIE_CHAT_MONTHS, SOPHIE_DAILY_OPTIONS } from '@/lib/constants/sophie'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'

/**
 * Réglages de la conversation avec Sophie (phase 2) : ouverture automatique sur l'accueil, plafond de
 * messages par jour (ce que consomme votre clé IA) et durée de conservation des conversations.
 */
export function SophieSettings({
  autoOpen,
  dailyMessages,
  chatMonths,
}: {
  autoOpen: boolean
  dailyMessages: number
  chatMonths: number
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [values, setValues] = useState({ autoOpen, dailyMessages, chatMonths })
  const [saving, setSaving] = useState(false)
  const changed = values.autoOpen !== autoOpen || values.dailyMessages !== dailyMessages || values.chatMonths !== chatMonths

  const save = async () => {
    setSaving(true)
    try {
      const result = await saveSophieSettings(values)
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Enregistrement impossible', description: result.error })
        return
      }
      toast({ title: 'Réglages de Sophie enregistrés' })
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Enregistrement impossible', description: CONNECTION_ERROR })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversation avec Sophie</CardTitle>
        <CardDescription>Sophie répond avec votre clé IA : ces réglages limitent ce qu’elle consomme.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            checked={values.autoOpen}
            onCheckedChange={(checked) => setValues({ ...values, autoOpen: checked === true })}
            className="mt-0.5"
          />
          <span>
            Ouvrir Sophie à mon arrivée sur le tableau de bord
            <span className="block text-xs text-muted-foreground">Une fois par visite ; si vous la fermez, elle reste fermée.</span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sophie-daily">Messages à Sophie par jour, au plus</Label>
            <Select value={String(values.dailyMessages)} onValueChange={(value) => setValues({ ...values, dailyMessages: Number(value) })}>
              <SelectTrigger id="sophie-daily">
                <SelectValue>{values.dailyMessages} messages</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SOPHIE_DAILY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} messages
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sophie-months">Garder les conversations</Label>
            <Select value={String(values.chatMonths)} onValueChange={(value) => setValues({ ...values, chatMonths: Number(value) })}>
              <SelectTrigger id="sophie-months">
                <SelectValue>{values.chatMonths} mois</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SOPHIE_CHAT_MONTHS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} mois
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Après ce délai sans nouveau message, une conversation est effacée.</p>
          </div>
        </div>

        <Button onClick={save} disabled={!changed || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  )
}
