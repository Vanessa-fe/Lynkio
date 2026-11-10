'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface KeywordPickerProps {
  value: string[]
  onChange: (keywords: string[]) => void
  // Mots-clés proposés pour le métier, ajoutés d'un clic
  suggestions: string[]
  max: number
  disabled?: boolean
  placeholder?: string
  inputLabel: string
  listLabel: string
}

const sameKeyword = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Liste de mots-clés : saisie libre, pastilles à retirer, suggestions à ajouter d'un clic
 */
export function KeywordPicker({
  value,
  onChange,
  suggestions,
  max,
  disabled,
  placeholder,
  inputLabel,
  listLabel,
}: KeywordPickerProps) {
  const [draft, setDraft] = useState('')
  const isFull = value.length >= max

  const add = (keyword: string) => {
    const clean = keyword.trim().replace(/\s+/g, ' ')
    setDraft('')
    if (clean.length < 2 || clean.length > 60 || isFull || value.some((existing) => sameKeyword(existing, clean))) return
    onChange([...value, clean])
  }

  const remaining = suggestions.filter((suggestion) => !value.some((existing) => sameKeyword(existing, suggestion)))

  return (
    <div className="space-y-3">
      <div className="flex gap-2 sm:max-w-md">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add(draft)
            }
          }}
          placeholder={placeholder}
          disabled={disabled || isFull}
          maxLength={60}
          aria-label={inputLabel}
        />
        <Button type="button" variant="outline" onClick={() => add(draft)} disabled={disabled || isFull}>
          Ajouter
        </Button>
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={listLabel}>
          {value.map((keyword) => (
            <li
              key={keyword}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-1 text-sm"
            >
              {keyword}
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item !== keyword))}
                className="rounded-full p-1 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Retirer ${keyword}`}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aucun mot-clé pour l&apos;instant.</p>
      )}

      {isFull && <p className="text-xs text-muted-foreground">{max} mots-clés au plus : retirez-en un pour en ajouter un autre.</p>}

      {remaining.length > 0 && !isFull && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Suggestions pour votre métier</p>
          <ul className="flex flex-wrap gap-2" aria-label="Suggestions de mots-clés">
            {remaining.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => add(suggestion)}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="h-3 w-3" />
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
