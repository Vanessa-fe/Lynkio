'use client'

import { clearSessionState, readSessionState, writeSessionState } from '@/lib/hooks/use-session-state'

/**
 * Personnes qu'on vient d'envoyer sur LinkedIn (sélection ou liste) : la page d'envoi les met en avant.
 * Gardé pour la session, pas dans l'adresse (une liste peut compter des centaines de personnes).
 */
export const LINKEDIN_FOCUS_KEY = 'filonea:linkedin-focus'

export type LinkedinFocus = { contactIds: string[]; label: string }

export function parseLinkedinFocus(raw: unknown): LinkedinFocus | null {
  if (!raw || typeof raw !== 'object') return null
  const saved = raw as Partial<Record<keyof LinkedinFocus, unknown>>
  const contactIds = Array.isArray(saved.contactIds)
    ? saved.contactIds.filter((id): id is string => typeof id === 'string')
    : []
  if (contactIds.length === 0) return null
  return { contactIds, label: typeof saved.label === 'string' ? saved.label : '' }
}

export function setLinkedinFocus(focus: LinkedinFocus) {
  writeSessionState(LINKEDIN_FOCUS_KEY, focus)
}

export function readLinkedinFocus(): LinkedinFocus | null {
  return readSessionState(LINKEDIN_FOCUS_KEY, parseLinkedinFocus)
}

export function clearLinkedinFocus() {
  clearSessionState(LINKEDIN_FOCUS_KEY)
}
