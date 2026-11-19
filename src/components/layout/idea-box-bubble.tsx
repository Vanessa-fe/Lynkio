'use client'

import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'filonea:idea-bubble'
const CHANGE_EVENT = 'idea-bubble-change'

type BubbleState = { firstSeen: string; done?: boolean }

function today() {
  return new Date().toISOString().slice(0, 10)
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function parse(raw: string | null): BubbleState | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as BubbleState
  } catch {
    return null
  }
}

function writeState(state: BubbleState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Stockage bloqué (navigation privée) : la bulle ne s'affiche pas, sans gêner le reste
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** La bulle ne revient plus une fois fermée ou après un clic sur la boîte à idées. */
export function dismissIdeaBubble() {
  const state = parse(readRaw())
  if (state?.done) return
  writeState({ firstSeen: state?.firstSeen ?? today(), done: true })
}

/**
 * Bulle à côté de « Boîte à idées », montrée à partir du deuxième jour d'utilisation,
 * jusqu'à ce qu'on la ferme ou qu'on ouvre la boîte à idées.
 */
export function IdeaBoxBubble({ hidden }: { hidden: boolean }) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null)
  const state = parse(raw)

  useEffect(() => {
    // Premier passage : on note le jour, la bulle viendra un autre jour
    if (!parse(readRaw())) writeState({ firstSeen: today() })
  }, [])

  useEffect(() => {
    if (hidden) dismissIdeaBubble()
  }, [hidden])

  const visible = !hidden && !!state && !state.done && state.firstSeen !== today()

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          className="absolute left-full top-1/2 z-50 ml-4 w-60"
          initial={{ opacity: 0, x: -8, y: '-50%' }}
          animate={{ opacity: 1, x: 0, y: '-50%' }}
          exit={{ opacity: 0, x: -8, y: '-50%' }}
          transition={{ duration: 0.3, ease: 'easeOut', delay: 0.6 }}
        >
          <div className="relative rounded-2xl bg-ink px-4 py-3 pr-9 text-sm leading-snug text-cream shadow-lift">
            {/* Pointe qui désigne la boîte à idées */}
            <span aria-hidden className="absolute -left-1.5 top-1/2 size-3 -translate-y-1/2 rotate-45 bg-ink" />
            Une idée pour améliorer Filonea ? Déposez-la ici 💡
            <button
              type="button"
              onClick={dismissIdeaBubble}
              className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full text-cream/70 hover:bg-cream/10 hover:text-cream"
              aria-label="Fermer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
