'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { linkedinPaceSchema, type LinkedinPaceInput } from '@/lib/validations/linkedin'
import { saveLinkedinPace } from '@/lib/actions/linkedin-sequences'
import {
  LINKEDIN_INVITATIONS_PER_DAY,
  LINKEDIN_INVITATIONS_PER_WEEK,
  LINKEDIN_MESSAGES_PER_DAY,
  LINKEDIN_PACE_HELP,
} from '@/lib/linkedin-caps'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'

interface LinkedinPaceFormProps {
  dailyInvitationsLimit: number
  dailyMessagesLimit: number
}

/**
 * Rythme d'envoi sur LinkedIn : invitations et messages par jour au plus. Vaut pour l'envoi automatique
 * comme pour les envois notés en un clic ; la limite de 100 invitations sur 7 jours ne se règle pas.
 */
export function LinkedinPaceForm({ dailyInvitationsLimit, dailyMessagesLimit }: LinkedinPaceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<LinkedinPaceInput>({
    resolver: zodResolver(linkedinPaceSchema),
    defaultValues: { dailyInvitationsLimit, dailyMessagesLimit },
  })

  const onSubmit = async (data: LinkedinPaceInput) => {
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof saveLinkedinPace>>
    try {
      result = await saveLinkedinPace(data)
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

    toast({ title: 'Rythme d’envoi enregistré' })
    reset(data)
    router.refresh()
  }

  return (
    <Card id="rythme" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Rythme d’envoi sur LinkedIn</CardTitle>
        <CardDescription>{LINKEDIN_PACE_HELP}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dailyInvitationsLimit">Invitations par jour</Label>
              <Input
                id="dailyInvitationsLimit"
                type="number"
                inputMode="numeric"
                min={LINKEDIN_INVITATIONS_PER_DAY.min}
                max={LINKEDIN_INVITATIONS_PER_DAY.max}
                step={1}
                className="w-28"
                disabled={isSaving}
                {...register('dailyInvitationsLimit', { valueAsNumber: true })}
              />
              {errors.dailyInvitationsLimit ? (
                <p className="text-sm text-destructive">{errors.dailyInvitationsLimit.message}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  De {LINKEDIN_INVITATIONS_PER_DAY.min} à {LINKEDIN_INVITATIONS_PER_DAY.max},{' '}
                  {LINKEDIN_INVITATIONS_PER_DAY.default} par défaut. Et jamais plus de {LINKEDIN_INVITATIONS_PER_WEEK} sur
                  7 jours.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyMessagesLimit">Messages par jour</Label>
              <Input
                id="dailyMessagesLimit"
                type="number"
                inputMode="numeric"
                min={LINKEDIN_MESSAGES_PER_DAY.min}
                max={LINKEDIN_MESSAGES_PER_DAY.max}
                step={1}
                className="w-28"
                disabled={isSaving}
                {...register('dailyMessagesLimit', { valueAsNumber: true })}
              />
              {errors.dailyMessagesLimit ? (
                <p className="text-sm text-destructive">{errors.dailyMessagesLimit.message}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Premier message et relances, de {LINKEDIN_MESSAGES_PER_DAY.min} à {LINKEDIN_MESSAGES_PER_DAY.max},{' '}
                  {LINKEDIN_MESSAGES_PER_DAY.default} par défaut.
                </p>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Avec l’envoi automatique, Filonea en envoie la moitié pendant les 14 premiers jours, et divise les
            invitations par 2 si peu d’entre elles sont acceptées. Les envois que vous notez en un clic comptent aussi.
          </p>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSaving || !isDirty}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isDirty ? 'Modifications non enregistrées.' : 'Aucune modification.'}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
