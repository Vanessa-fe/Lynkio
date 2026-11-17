'use client'

/**
 * Recherche lancée à la main dont on attend la fin. Gardée dans le stockage de session du navigateur
 * (et en mémoire s'il est indisponible) : la fenêtre de fin s'ouvre même après un changement de page
 * ou un rechargement pendant la recherche.
 */

const KEY = 'filonea:watched-run'
export const WATCH_EVENT = 'filonea:watch-run'

let memoryRun: string | null = null

export function watchRun(runId: string) {
  memoryRun = runId
  try {
    window.sessionStorage.setItem(KEY, runId)
  } catch {
    // stockage indisponible (navigation privée) : la copie en mémoire suffit pour la visite
  }
  window.dispatchEvent(new Event(WATCH_EVENT))
}

export function watchedRun(): string | null {
  try {
    return window.sessionStorage.getItem(KEY) ?? memoryRun
  } catch {
    return memoryRun
  }
}

export function stopWatching() {
  memoryRun = null
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // rien à faire
  }
}
