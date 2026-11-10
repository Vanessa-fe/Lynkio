'use client'

import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { deleteAccount } from '@/lib/actions/account'
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/constants/account'
import { CONNECTION_ERROR } from '@/lib/constants/errors'

export function DeleteAccount() {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const isConfirmed = confirmation.trim().toUpperCase() === ACCOUNT_DELETION_CONFIRMATION

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isConfirmed) return
    setError(null)
    setIsDeleting(true)
    try {
      // Réussite : le serveur déconnecte la personne et la renvoie vers l'accueil
      const result = await deleteAccount(confirmation)
      if (result && !result.success) setError(result.error ?? 'Suppression impossible')
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Supprimer mon compte</CardTitle>
        <CardDescription>
          Votre compte et toutes vos données sont effacés tout de suite et définitivement : entreprises, personnes,
          échanges, listes, réglages et clés enregistrées. Pensez à exporter vos entreprises avant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isOpen ? (
          <form onSubmit={handleSubmit} className="space-y-3 sm:max-w-md" noValidate>
            <Label htmlFor="delete-confirmation">
              Pour confirmer, écrivez <strong>{ACCOUNT_DELETION_CONFIRMATION}</strong>
            </Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              disabled={isDeleting}
              aria-invalid={error ? true : undefined}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="destructive" disabled={!isConfirmed || isDeleting}>
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Supprimer définitivement
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsOpen(false)
                  setConfirmation('')
                  setError(null)
                }}
                disabled={isDeleting}
              >
                Annuler
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="outline" className="text-destructive" onClick={() => setIsOpen(true)}>
            Supprimer mon compte…
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
