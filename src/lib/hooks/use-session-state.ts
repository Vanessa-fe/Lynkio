'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * État gardé pour la session (onglet) dans le stockage du navigateur, avec une copie en mémoire s'il
 * est indisponible (navigation privée) : on retrouve ses filtres et sa sélection en revenant sur une page.
 * Côté serveur et au premier rendu : la valeur par défaut (pas d'écart à l'hydratation).
 */

const memory = new Map<string, string>()
const listeners = new Map<string, Set<() => void>>()

function read(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? memory.get(key) ?? ''
  } catch {
    return memory.get(key) ?? ''
  }
}

function write(key: string, raw: string) {
  memory.set(key, raw)
  try {
    window.sessionStorage.setItem(key, raw)
  } catch {
    // stockage indisponible : la copie en mémoire suffit pour la visite
  }
  listeners.get(key)?.forEach((listener) => listener())
}

export function clearSessionState(key: string) {
  memory.delete(key)
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // rien à faire
  }
  listeners.get(key)?.forEach((listener) => listener())
}

export function useSessionState<T>(key: string, parse: (raw: unknown) => T): [T, (value: T) => void] {
  const subscribe = useCallback(
    (listener: () => void) => {
      const set = listeners.get(key) ?? new Set()
      set.add(listener)
      listeners.set(key, set)
      return () => {
        set.delete(listener)
      }
    },
    [key]
  )
  const raw = useSyncExternalStore(subscribe, () => read(key), () => '')
  let value: T
  try {
    value = parse(raw ? JSON.parse(raw) : undefined)
  } catch {
    value = parse(undefined)
  }
  const setValue = useCallback((next: T) => write(key, JSON.stringify(next)), [key])
  return [value, setValue]
}

/** Lecture ponctuelle, hors composant (par exemple après un clic) */
export function readSessionState<T>(key: string, parse: (raw: unknown) => T): T {
  try {
    const raw = read(key)
    return parse(raw ? JSON.parse(raw) : undefined)
  } catch {
    return parse(undefined)
  }
}

export function writeSessionState<T>(key: string, value: T) {
  write(key, JSON.stringify(value))
}
