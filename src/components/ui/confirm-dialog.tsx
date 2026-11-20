'use client'

import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Fenêtre de confirmation aux couleurs de Filonea, à la place de la fenêtre du navigateur
 * (window.confirm). S'utilise comme elle : `if (!(await confirmAction({ ... }))) return`.
 * Un seul <ConfirmDialog /> est monté dans le layout racine.
 */
export interface ConfirmOptions {
  title: string
  description?: string
  // Libellé du bouton qui valide (par défaut « Confirmer »)
  confirmLabel?: string
  // Action qui efface ou retire quelque chose : bouton rouge
  destructive?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void
}

let pending: PendingConfirm | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // Une demande déjà ouverte est considérée comme annulée
  pending?.resolve(false)
  return new Promise((resolve) => {
    pending = { ...options, resolve }
    // Ouverture au tour suivant : un menu déroulant qui se ferme au même moment (Radix) libère d'abord
    // le focus et les clics de la page, sinon la page peut rester inerte après la fenêtre
    setTimeout(emit, 0)
  })
}

function settle(confirmed: boolean) {
  if (!pending) return
  pending.resolve(confirmed)
  pending = null
  emit()
}

export function ConfirmDialog() {
  const current = useSyncExternalStore(
    subscribe,
    () => pending,
    () => null
  )

  return (
    <Dialog open={current !== null} onOpenChange={(open) => !open && settle(false)}>
      {current && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{current.title}</DialogTitle>
            {current.description && (
              <DialogDescription className="whitespace-pre-line">{current.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => settle(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant={current.destructive ? 'destructive' : 'default'}
              onClick={() => settle(true)}
              autoFocus
            >
              {current.confirmLabel ?? 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
