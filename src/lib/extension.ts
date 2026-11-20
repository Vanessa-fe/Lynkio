/**
 * Échanges avec l'extension Chrome de Filonea (dépôt privé filonea-extension).
 *
 * L'extension accepte les messages de filonea.fr (et de localhost dans sa version
 * de développement) grâce à « externally_connectable » : Chrome expose alors
 * chrome.runtime.sendMessage à la page. Sans l'extension, ou hors de Chrome,
 * les fonctions ci-dessous renvoient null.
 */

// Identifiants de l'extension, essayés dans cet ordre :
// - version installée à la main (clé publique du manifeste) : la version complète, avec l'envoi automatique ;
// - version du Chrome Web Store (identifiant donné par Google le 20/11/2026), celle des utilisateurs.
export const EXTENSION_IDS = ['fofnjkhefbjoncpjhnfkdcghenjaobkh', 'dbodjbpdhdikcidhgiajaimbgjndndip'] as const

export type ExtensionStatus = {
  installed: true
  version: string
  connected: boolean
  email: string | null
  /** Envoi automatique présent dans cette version (absent de la version du Chrome Web Store pour l'instant) */
  autoSend?: boolean
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
 * Envoie un message à une version de l'extension. null si elle est absente ou ne répond pas.
 */
function sendTo<T>(runtime: ChromeRuntime, extensionId: string, message: ExtensionMessage, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs)
    try {
      runtime.sendMessage(extensionId, message, (response) => {
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

/**
 * Envoie un message à l'extension : à la première version installée qui répond. null si aucune.
 */
export async function sendToExtension<T>(message: ExtensionMessage, timeoutMs = 3000): Promise<T | null> {
  const runtime = chromeRuntime()
  if (!runtime) return null

  for (const extensionId of EXTENSION_IDS) {
    const response = await sendTo<T>(runtime, extensionId, message, timeoutMs)
    if (response !== null) return response
  }
  return null
}
