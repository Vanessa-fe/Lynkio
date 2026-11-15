'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { LEGAL } from '@/lib/constants/legal'
import { confirmOptOut } from './actions'

export function OptOutForm({ token }: { token: string }) {
  const [result, confirm, pending] = useActionState(confirmOptOut, null)

  if (result === 'done') {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold">C&apos;est noté</h1>
        <p className="text-ink/75">
          Vous ne recevrez plus de message de prospection de cette personne via Filonea. Vous n&apos;avez rien
          d&apos;autre à faire.
        </p>
      </div>
    )
  }

  return (
    <form action={confirm} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <h1 className="font-display text-2xl font-bold">Ne plus être contacté</h1>
      <p className="text-ink/75">
        Vous avez reçu un e-mail de prospection préparé avec Filonea. Confirmez pour que son expéditeur ne vous
        recontacte plus.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Je ne veux plus être contacté'}
      </Button>
      {result === 'invalid' && (
        <p role="alert" className="text-sm text-destructive">
          Ce lien n&apos;est pas valide ou a expiré. Répondez « stop » à l&apos;e-mail reçu, ou écrivez à{' '}
          <a href={`mailto:${LEGAL.email}`} className="underline">
            {LEGAL.email}
          </a>
          .
        </p>
      )}
      {result === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          L&apos;enregistrement n&apos;a pas abouti. Réessayez dans un instant.
        </p>
      )}
    </form>
  )
}
