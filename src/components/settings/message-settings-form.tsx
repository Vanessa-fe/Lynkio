'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { messageSettingsSchema, type MessageSettingsInput } from '@/lib/validations/user-profile'
import { saveMessageSettings } from '@/lib/actions/user-profile'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { WHATSAPP_MAX_DAILY_LIMIT, WHATSAPP_MIN_DAILY_LIMIT, WHATSAPP_SAFE_DAILY_LIMIT } from '@/lib/whatsapp'

interface MessageSettingsFormProps {
  pitch: string | null
  signature: string | null
  // Consignes de style pour tous les messages
  messageStyle: string | null
  // Plafond WhatsApp du jour ; null : pas d'offre Pro, réglage masqué
  whatsappDailyLimit: number | null
}

export function MessageSettingsForm({ pitch, signature, messageStyle, whatsappDailyLimit }: MessageSettingsFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<MessageSettingsInput>({
    resolver: zodResolver(messageSettingsSchema),
    defaultValues: {
      pitch: pitch ?? '',
      signature: signature ?? '',
      messageStyle: messageStyle ?? '',
      ...(whatsappDailyLimit !== null ? { whatsappDailyLimit } : {}),
    },
  })

  const pitchLength = useWatch({ control, name: 'pitch' })?.length ?? 0
  const styleLength = useWatch({ control, name: 'messageStyle' })?.length ?? 0
  const dailyLimit = useWatch({ control, name: 'whatsappDailyLimit' })

  const onSubmit = async (data: MessageSettingsInput) => {
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof saveMessageSettings>>
    try {
      result = await saveMessageSettings(data)
    } catch {
      toast({ variant: 'destructive', title: 'Enregistrement impossible', description: CONNECTION_ERROR })
      return
    } finally {
      setIsSaving(false)
    }

    if (!result.success) {
      toast({ variant: 'destructive', title: 'Enregistrement impossible', description: result.error })
      return
    }

    toast({ title: 'Réglages enregistrés', description: 'Sophie s\'en servira pour vos prochains messages.' })
    reset(data)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Votre présentation</CardTitle>
          <CardDescription>Qui vous êtes, ce que vous faites et pour qui, en deux ou trois phrases.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="pitch" className="sr-only">
            Votre présentation
          </Label>
          <Textarea
            id="pitch"
            rows={6}
            placeholder="Ex. : Développeuse web freelance (React, Next.js, TypeScript), je refonds des sites et crée des applications web pour des PME, entièrement à distance. J'interviens sur des projets complets : refonte, migration, nouvelles fonctionnalités."
            disabled={isSaving}
            {...register('pitch')}
          />
          <div className="flex justify-between gap-4 text-sm">
            {errors.pitch ? <p className="text-destructive">{errors.pitch.message}</p> : <span />}
            <span className="text-muted-foreground tabular-nums">{pitchLength} / 1 500</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Votre style</CardTitle>
          <CardDescription>
            Comment vous écrivez, pour tous vos messages : longueur, ton, formules que vous aimez ou que vous ne voulez
            jamais lire. Sophie s’y tient à chaque rédaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="messageStyle" className="sr-only">
            Votre style
          </Label>
          <Textarea
            id="messageStyle"
            rows={4}
            placeholder={
              'Ex. : Messages très courts, 3 phrases maximum. Ton direct et simple. Je me présente en une phrase, je propose un appel de 10 minutes. Jamais de « J’espère que vous allez bien ».'
            }
            disabled={isSaving}
            {...register('messageStyle')}
          />
          <div className="flex justify-between gap-4 text-sm">
            {errors.messageStyle ? <p className="text-destructive">{errors.messageStyle.message}</p> : <span />}
            <span className="text-muted-foreground tabular-nums">{styleLength} / 1 000</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signature des e-mails</CardTitle>
          <CardDescription>Ajoutée à la fin des e-mails. Sinon : votre prénom et votre activité.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="signature" className="sr-only">
            Signature des e-mails
          </Label>
          <Textarea
            id="signature"
            rows={4}
            placeholder={'Ex. :\nCamille Martin\nDéveloppeuse web freelance\nhttps://monsite.fr'}
            disabled={isSaving}
            {...register('signature')}
          />
          {errors.signature && <p className="text-sm text-destructive">{errors.signature.message}</p>}
        </CardContent>
      </Card>

      {whatsappDailyLimit !== null && (
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp</CardTitle>
            <CardDescription>
              WhatsApp peut bloquer un numéro quand des destinataires le signalent. Restez sous{' '}
              {WHATSAPP_SAFE_DAILY_LIMIT} messages par jour, surtout avec un numéro récent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="whatsappDailyLimit">Messages WhatsApp par jour</Label>
            <Input
              id="whatsappDailyLimit"
              type="number"
              inputMode="numeric"
              min={WHATSAPP_MIN_DAILY_LIMIT}
              max={WHATSAPP_MAX_DAILY_LIMIT}
              step={1}
              className="w-28"
              disabled={isSaving}
              {...register('whatsappDailyLimit', { valueAsNumber: true })}
            />
            {errors.whatsappDailyLimit ? (
              <p className="text-sm text-destructive">{errors.whatsappDailyLimit.message}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                De {WHATSAPP_MIN_DAILY_LIMIT} à {WHATSAPP_MAX_DAILY_LIMIT}, 15 par défaut. Le compteur repart à zéro à
                minuit.
                {typeof dailyLimit === 'number' && dailyLimit > WHATSAPP_SAFE_DAILY_LIMIT && (
                  <span className="text-amber-700 dark:text-amber-400"> Au-delà de {WHATSAPP_SAFE_DAILY_LIMIT}, le risque de blocage augmente.</span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-20 md:bottom-4 z-10 flex items-center gap-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
        <Button type="submit" disabled={isSaving || !isDirty}>
          {isSaving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {isDirty ? 'Modifications non enregistrées.' : 'Aucune modification.'}
        </p>
      </div>
    </form>
  )
}
