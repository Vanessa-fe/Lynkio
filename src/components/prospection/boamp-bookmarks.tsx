'use client'

import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'

type Bookmark = { id: string; title: string; source: string; deadline: string; status: string; savedAt: string }
type Props = { userId: string; notice?: Omit<Bookmark, 'savedAt'> }

function subscribe(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener('boamp-bookmarks', notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener('boamp-bookmarks', notify)
  }
}

function read(raw: string | null): Bookmark[] {
  if (!raw) return []
  try {
    const rows: unknown = JSON.parse(raw)
    return Array.isArray(rows) ? rows.filter(row => row && typeof row.id === 'string'
      && /^\d{2}-\d+$/.test(row.id) && typeof row.title === 'string'
      && row.source === 'https://www.boamp.fr/pages/avis/?q=idweb:' + row.id
      && typeof row.status === 'string' && Number.isFinite(Date.parse(row.deadline))
      && Number.isFinite(Date.parse(row.savedAt))) : []
  } catch { return [] }
}

const date = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })

export function BoampBookmarks({ userId, notice }: Props) {
  const key = 'filonea/boamp/' + userId
  const [error, setError] = useState(false)
  const raw = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key) } catch { return null }
  }, () => null)
  const bookmarks = read(raw)

  function toggle(id: string) {
    try {
      const current = read(localStorage.getItem(key))
      const next = current.filter(row => row.id !== id)
      if (next.length === current.length && notice) next.unshift({ ...notice, savedAt: new Date().toISOString() })
      localStorage.setItem(key, JSON.stringify(next))
      window.dispatchEvent(new Event('boamp-bookmarks'))
      setError(false)
    } catch { setError(true) }
  }

  return <>
    {notice ? (
      <Button variant="outline" size="sm" onClick={() => toggle(notice.id)}>
        {bookmarks.some(row => row.id === notice.id) ? 'Retirer des avis conservés' : 'Conserver cet avis'}
      </Button>
    ) : bookmarks.length > 0 && (
      <details className="rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer font-medium">Avis conservés dans ce navigateur ({bookmarks.length})</summary>
        <ul className="divide-y">{bookmarks.map(row => <li className="space-y-1 py-3" key={row.id}>
          <a href={row.source} className="font-medium underline" target="_blank" rel="noopener noreferrer">{row.title} · {row.id}</a>
          <p>{row.status === 'RECTIFICATIF' ? 'Avis rectificatif' : 'Avis initial'} conservé le {date.format(new Date(row.savedAt))}.
            Échéance publiée à cette date · {date.format(new Date(row.deadline))} (heure de Paris).</p>
          <button className="underline" onClick={() => toggle(row.id)}>Retirer des avis conservés</button>
        </li>)}</ul>
        <p className="text-muted-foreground">Ouvrez l’avis officiel pour vérifier les dernières modifications.</p>
      </details>
    )}
    {error && <p role="alert">L’enregistrement dans ce navigateur a échoué.</p>}
  </>
}
