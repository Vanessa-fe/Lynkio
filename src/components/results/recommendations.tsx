'use client'

import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SMALL_SAMPLE } from '@/lib/funnel'
import type { Suggestion } from '@/lib/prospect-recommendations'

const subscribe = (notify: () => void) => {
  window.addEventListener('storage', notify)
  window.addEventListener('recommendation-decision', notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener('recommendation-decision', notify)
  }
}
const percent = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 })

function rate(data: { successes: number; contacted: number; low: number; high: number }) {
  return `${data.successes} sur ${data.contacted} entreprises contactées (${percent.format(data.successes / data.contacted)}). Intervalle à 95 % de ${percent.format(data.low)} à ${percent.format(data.high)}.`
}

function SuggestionRow({ item, scope }: { item: Suggestion; scope: string }) {
  const key = 'filonea/recommendations/' + scope + '/' + item.id
  const [error, setError] = useState(false)
  const decision = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key) } catch { return null }
  }, () => null)

  function decide(value: 'approved' | 'ignored' | null) {
    try {
      if (value) localStorage.setItem(key, value)
      else localStorage.removeItem(key)
      setError(false)
      window.dispatchEvent(new Event('recommendation-decision'))
    } catch { setError(true) }
  }

  return (
    <li className="space-y-2 border-t py-4 text-sm">
      <h3 className="font-medium">{item.title} · {item.label}</h3>
      {decision !== 'ignored' && (item.kind === 'compare' ? (
        <div className="space-y-1 text-muted-foreground">
          <p>{item.metric.charAt(0).toUpperCase() + item.metric.slice(1)} dans ce groupe · {rate(item.group)}</p>
          <p>Autres groupes comparables réunis · {rate(item.others)}</p>
        </div>
      ) : (
        <p className="text-muted-foreground">
          {item.contacted} sur {item.found} entreprises contactées. Il reste {item.available} {item.available === 1 ? 'fiche ouverte' : 'fiches ouvertes'} à explorer.
          C’est le secteur peu testé qui en compte le plus. Son rendement reste à mesurer.
        </p>
      ))}
      {decision ? (
        <div className="flex items-center gap-3">
          <span>{decision === 'approved' ? 'Piste approuvée' : 'Piste ignorée'}</span>
          <Button variant="ghost" size="sm" onClick={() => decide(null)}>Reconsidérer</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => decide('approved')}>Approuver la piste</Button>
          <Button variant="ghost" size="sm" onClick={() => decide('ignored')}>Ignorer</Button>
        </div>
      )}
      {error && <p role="alert">Votre navigateur n’a pas pu enregistrer ce choix.</p>}
    </li>
  )
}

export function Recommendations({ suggestions, scope }: { suggestions: Suggestion[]; scope: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pistes de prospection</CardTitle>
        <CardDescription>À partir de vos fiches sur la période et avec les filtres sélectionnés.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!suggestions.some(s => s.kind === 'compare') && <p>Les résultats disponibles ne permettent pas encore de privilégier un secteur ou une recherche.</p>}
        <ul>{suggestions.map(item => <SuggestionRow key={scope + item.id} item={item} scope={scope} />)}</ul>
        <details className="text-muted-foreground">
          <summary className="cursor-pointer">Comment les pistes sont choisies</summary>
          <p className="mt-2">Pour chaque résultat, on compare un secteur aux autres secteurs identifiés,
            ou une recherche aux autres recherches identifiées. Il faut au moins {SMALL_SAMPLE} entreprises contactées
            de chaque côté. On retient le plus grand écart entre les intervalles de Wilson à 95 % quand ils sont disjoints.</p>
          <p className="mt-2">Les étapes sont celles de l’entonnoir. Les fiches récentes ont eu moins de temps pour aboutir.
            Les écarts observés peuvent tenir au suivi des fiches, à leur ancienneté ou au hasard des comparaisons.</p>
        </details>
        {suggestions.length > 0 && <p className="text-xs text-muted-foreground">Approuver ou ignorer mémorise votre choix dans ce navigateur. Vous gardez la main sur vos recherches.</p>}
      </CardContent>
    </Card>
  )
}
