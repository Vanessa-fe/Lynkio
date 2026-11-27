'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface LinkedinRiskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Plafonds réglés par l'utilisatrice (les 14 premiers jours, la moitié seulement)
  invitationsPerDay: number
  invitationsPerWeek: number
  messagesPerDay: number
  busy: boolean
  onConfirm: () => void
}

/**
 * Avant d'activer l'envoi automatique : LinkedIn interdit les outils automatisés et peut restreindre
 * un compte. L'utilisatrice coche qu'elle a compris et accepte le risque ; sans la case, rien ne s'active.
 */
export function LinkedinRiskDialog({
  open,
  onOpenChange,
  invitationsPerDay,
  invitationsPerWeek,
  messagesPerDay,
  busy,
  onConfirm,
}: LinkedinRiskDialogProps) {
  const [accepted, setAccepted] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (busy) return
    if (!next) setAccepted(false)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Avant d’activer l’envoi automatique sur LinkedIn
          </DialogTitle>
          <DialogDescription className="sr-only">
            Risques pour votre compte LinkedIn et conseils avant d’activer l’envoi automatique.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p>
            LinkedIn n’autorise pas les outils qui agissent automatiquement sur un compte. Filonea fait son possible
            pour rester discret (volumes limités, pauses), mais LinkedIn peut quand même repérer l’automatisation et
            restreindre votre compte : blocage temporaire, vérification d’identité, ou plus rarement suspension.
          </p>
          <p>Votre compte LinkedIn compte sûrement beaucoup pour votre activité. Nous vous conseillons :</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              de garder des volumes bas (Filonea vous limite à {invitationsPerDay} invitations par jour et{' '}
              {invitationsPerWeek} par semaine au maximum, et à {messagesPerDay} messages par jour ; la moitié
              seulement pendant les 14 premiers jours) ;
            </li>
            <li>d’arrêter l’envoi automatique si LinkedIn vous demande une vérification ;</li>
            <li>de préférer l’envoi manuel pour vos prospects les plus importants.</li>
          </ul>

          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
            <Checkbox
              id="linkedin-risk"
              checked={accepted}
              onCheckedChange={(value) => setAccepted(value === true)}
              disabled={busy}
              className="mt-0.5"
            />
            <Label htmlFor="linkedin-risk" className="text-sm font-normal leading-snug">
              J’ai compris que l’envoi automatique peut entraîner une restriction de mon compte LinkedIn, et j’en
              accepte le risque.
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={!accepted || busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
            Activer l’envoi automatique
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
