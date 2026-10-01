'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { messageSettingsSchema, type MessageSettingsInput } from '@/lib/validations/user-profile'
import { saveMessageSettings } from '@/lib/actions/user-profile'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'

interface MessageSettingsFormProps {
  pitch: string | null
  signature: string | null
}

export function MessageSettingsForm({ pitch, signature }: MessageSettingsFormProps) {
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
    defaultValues: { pitch: pitch ?? '', signature: signature ?? '' },
  })

  const pitchLength = useWatch({ control, name: 'pitch' })?.length ?? 0

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
          <CardDescription>
            Qui vous êtes, ce que vous faites et pour qui, en deux ou trois phrases. Sophie en tire la phrase qui
            vous présente dans chaque message. Elle n&apos;invente rien : sans présentation, elle se limite à votre
            métier et à vos technologies.
          </CardDescription>
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
          <CardTitle>Signature des e-mails</CardTitle>
          <CardDescription>
            Ajoutée telle quelle à la fin des e-mails préparés. Les messages LinkedIn sont signés de votre
            prénom. Sans signature, Sophie met votre prénom et le nom de votre activité.
          </CardDescription>
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
