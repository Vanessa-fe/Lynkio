/**
 * Échanges avec l'extension Chrome de Filonea (dépôt privé filonea-extension).
 *
 * L'extension accepte les messages de filonea.fr (et de localhost dans sa version
 * de développement) grâce à « externally_connectable » : Chrome expose alors
 * chrome.runtime.sendMessage à la page. Sans l'extension, ou hors de Chrome,
 * les fonctions ci-dessous renvoient null.
 */

// Identifiant fixe, tiré de la clé publique déclarée dans le manifeste de l'extension
export const EXTENSION_ID = 'fofnjkhefbjoncpjhnfkdcghenjaobkh'

export type ExtensionStatus = {
  installed: true
  version: string
  connected: boolean
  email: string | null
}

export type ExtensionMessage =
  | { type: 'ping' }
  | { type: 'connect'; tokenHash: string }
  | { type: 'disconnect' }

type ChromeRuntime = {
  sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void
  lastError?: { message?: string }
}

function chromeRuntime(): ChromeRuntime | null {
  const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime
  return typeof runtime?.sendMessage === 'function' ? runtime : null
}

/**
 * Envoie un message à l'extension. null si elle est absente ou ne répond pas.
 */
export function sendToExtension<T>(message: ExtensionMessage, timeoutMs = 3000): Promise<T | null> {
  const runtime = chromeRuntime()
  if (!runtime) return Promise.resolve(null)

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs)
    try {
      runtime.sendMessage(EXTENSION_ID, message, (response) => {
        clearTimeout(timer)
        // Extension absente : Chrome remplit lastError au lieu de lever une erreur
        resolve(runtime.lastError ? null : ((response as T | undefined) ?? null))
      })
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}
