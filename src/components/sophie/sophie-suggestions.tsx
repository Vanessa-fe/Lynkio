'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BellRing, ChevronDown, Mail, Sparkles, UserRound, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackSophieSuggestionFollowed } from '@/lib/actions/sophie-suggestions'
import type { SophieSuggestion, SuggestionKind } from '@/lib/sophie-suggestions'
import { useSophie } from './sophie-provider'

const ICONS: Record<SuggestionKind, typeof Mail> = {
  reminder: BellRing,
  no_reply: Mail,
  decision_maker: UserRound,
  discoveries: Sparkles,
}

/**
 * Suggestions proactives de Sophie (phase 5) : actions concrètes tirées de règles Filonéa (sans IA).
 * « Ouvrir » mène à la fiche ou à l'écran concerné ; « Ignorer » écarte la suggestion pour de bon.
 * Accueil (conversation vide) : liste complète. Conversation en cours : une ligne qui se déplie.
 */
export function SophieSuggestions({ compact = false }: { compact?: boolean }) {
  const { suggestions, dismissSuggestion, closePanel } = useSophie()
  const [expanded, setExpanded] = useState(false)

  if (!suggestions || suggestions.suggestions.length === 0) return null
  const items = suggestions.suggestions

  if (compact && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>
          <span className="font-medium">
            {items.length} suggestion{items.length > 1 ? 's' : ''} de Sophie
          </span>
          <span className="text-muted-foreground"> · {items[0]!.label}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    )
  }

  // Sur mobile, le panneau couvre la page : il se ferme pour laisser voir la fiche ouverte
  const follow = (suggestion: SophieSuggestion) => {
    void trackSophieSuggestionFollowed(suggestion.key).catch(() => undefined)
    if (window.matchMedia('(max-width: 1279px)').matches) closePanel()
  }

  return (
    <section className="space-y-2" aria-label="Suggestions de Sophie">
      {!compact && <p className="text-sm">{suggestions.summary}</p>}
      <ul className="space-y-2">
        {items.map((suggestion) => {
          const Icon = ICONS[suggestion.kind]
          return (
            <li key={suggestion.key} className="group relative flex items-start gap-3 rounded-xl border bg-card p-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-wine" aria-hidden="true" />
              <Link
                href={suggestion.href}
                onClick={() => follow(suggestion)}
                className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block text-sm font-medium after:absolute after:inset-0">{suggestion.label}</span>
                <span className="block text-xs text-muted-foreground">{suggestion.detail}</span>
              </Link>
              <button
                type="button"
                onClick={() => dismissSuggestion(suggestion.key)}
                className="relative z-10 -m-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Ignorer : ${suggestion.label}`}
                title="Ignorer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
      <p className={cn('text-xs text-muted-foreground', compact && 'flex items-center justify-between')}>
        <span>Suggestions Filonéa, calculées sur vos données (sans IA).</span>
        {compact && (
          <button type="button" onClick={() => setExpanded(false)} className="underline-offset-2 hover:underline">
            Replier
          </button>
        )}
      </p>
    </section>
  )
}

/** Nombre de suggestions, pour la pastille du bouton Sophie */
export function useSuggestionCount(): number {
  const { suggestions } = useSophie()
  return suggestions?.suggestions.length ?? 0
}
