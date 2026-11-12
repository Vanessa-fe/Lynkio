import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BoampBookmarks } from '@/components/prospection/boamp-bookmarks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuthUser } from '@/lib/supabase/auth'
import { getOffer } from '@/lib/queries/offer'
import { filterError, findNotices, type Filters } from '@/lib/boamp'

type Params = Promise<Record<string, string | string[] | undefined>>
const deadline = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short',
})

export default async function BoampPage({ searchParams }: { searchParams: Params }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const [params, offer] = await Promise.all([searchParams, getOffer()])
  const value = (key: string) => typeof params[key] === 'string' ? params[key].trim() : ''
  const filters: Filters = {
    service: value('service'), cpv: value('cpv'), buyer: value('buyer'),
    department: value('department').toUpperCase(), days: value('days'), zone: value('zone') || 'publication',
  }
  const page = Number(value('page') || 1)
  let error = filterError(filters)
  if (!Number.isInteger(page) || page < 1 || page > 1000) error = 'Numéro de page invalide.'
  let result: Awaited<ReturnType<typeof findNotices>> | undefined
  if (value('search') === '1' && !error) {
    try { result = await findNotices(filters, page) }
    catch { error = 'La recherche BOAMP est temporairement indisponible. Réessayez dans quelques instants.' }
  }
  const pageUrl = (n: number) => '?' + new URLSearchParams({ ...filters, search: '1', page: String(n) })
  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/prospection" className="text-sm underline">Retour à la prospection</Link>
      <header>
        <h1 className="text-3xl font-bold">Marchés publics de services</h1>
        <p className="mt-2 text-muted-foreground">Consultez les appels d’offres publiés au BOAMP dont l’échéance est encore à venir.</p>
      </header>
      <form action="/prospection/boamp" method="get" className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <input type="hidden" name="search" value="1" />
        <label>Prestation ou mot-clé
          <Input name="service" list="boamp-services" defaultValue={filters.service} maxLength={80} placeholder="Ex. formation" />
          <datalist id="boamp-services">{offer?.services.map((s, i) => <option key={i} value={s.name} />)}</datalist>
        </label>
        <div>
          <div className="relative flex items-center gap-1">
            <label htmlFor="boamp-cpv">Code CPV (facultatif)</label>
            <div className="group">
              <span tabIndex={0} role="img" aria-label="Aide sur le code CPV" aria-describedby="boamp-cpv-help" className="flex h-6 w-6 cursor-help items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring">
                <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-xs font-semibold text-muted-foreground">!</span>
              </span>
              <p id="boamp-cpv-help" role="tooltip" className="invisible absolute left-0 top-full z-10 group-hover:visible group-has-[:focus-visible]:visible w-full max-w-xs rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md">
                classification européenne des achats publics. Par exemple, le code 80580000 désigne la formation linguistique
              </p>
            </div>
          </div>
          <Input id="boamp-cpv" name="cpv" aria-describedby="boamp-cpv-help" defaultValue={filters.cpv} inputMode="numeric" pattern="[0-9]{8}" placeholder="Ex. 80580000" />
        </div>
        <label>Département
          <Input name="department" defaultValue={filters.department} maxLength={3} placeholder="Ex. 75" />
        </label>
        <label>Zone du département
          <select className="block h-10 w-full rounded-md border bg-background px-3 text-sm" name="zone" defaultValue={filters.zone}>
            <option value="publication">Publication de l’avis</option>
            <option value="prestation">Lieu de prestation renseigné</option>
          </select>
        </label>
        <label>Organisme acheteur
          <Input name="buyer" defaultValue={filters.buyer} maxLength={80} placeholder="Nom de l’organisme" />
        </label>
        <label>Échéance de réponse
          <select className="block h-10 w-full rounded-md border bg-background px-3 text-sm" name="days" defaultValue={filters.days}>
            <option value="">Toutes les échéances à venir</option>
            {[7, 30, 90].map(days => <option value={days} key={days}>Dans les {days} prochains jours</option>)}
          </select>
        </label>
        <Button className="self-end" type="submit">Rechercher au BOAMP</Button>
      </form>
      <BoampBookmarks userId={user.id} />
      {error && <p role="alert">{error}</p>}
      {result && <section className="space-y-4" aria-label="Résultats de la recherche">
        {!result.notices.length && <p>Aucun avis correspondant sur cette page.</p>}
        {result.notices.map(n => <Card key={n.idweb}>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Appel d’offres · {n.etat === 'RECTIFICATIF' ? 'Avis rectificatif' : 'Avis initial'} · {n.idweb}</p>
            <CardTitle className="text-lg">{n.objet}</CardTitle>
            <p>{n.nomacheteur}</p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">Répondre avant le <time dateTime={n.datelimitereponse}>{deadline.format(new Date(n.datelimitereponse))}</time> (heure de Paris)</p>
            <p>Publié le {new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' }).format(new Date(n.dateparution))}</p>
            {n.code_departement_prestation?.length ? <p>Départements de prestation · {n.code_departement_prestation.join(', ')}</p> : null}
            {n.codes.length > 0 && <p>Codes CPV · {n.codes.join(', ')}</p>}
            {n.reservedLot && <p>Participation réservée signalée pour au moins un lot. Vérifiez les conditions de ce lot.</p>}
            <p>{n.solo ? <>Candidature individuelle prévue dans l’avis · « {n.solo} ».</> : 'Possibilité de candidater seul à vérifier dans le dossier.'}
              {' '}Vérifiez les capacités, références et qualifications exigées pour le lot visé.</p>
            <a className="inline-block font-medium text-primary underline" href={n.url_avis} target="_blank" rel="noopener noreferrer">Consulter l’avis officiel {n.idweb}</a>
            <div><BoampBookmarks userId={user.id} notice={{ id: n.idweb, title: n.objet, source: n.url_avis, deadline: n.datelimitereponse, status: n.etat }} /></div>
          </CardContent>
        </Card>)}
        <nav aria-label="Pages de résultats" className="flex items-center gap-4 text-sm">
          {page > 1 && <Link href={pageUrl(page - 1)} className="underline" prefetch={false}>Précédente</Link>}
          <span>Page {page}</span>
          {result.hasNext && <Link href={pageUrl(page + 1)} className="underline" prefetch={false}>Suivante</Link>}
        </nav>
      </section>}
      <footer className="text-xs text-muted-foreground">Source · Direction de l’information légale et administrative (DILA), Bulletin officiel des annonces des marchés publics, Licence Ouverte.
        {' '}<a className="underline" href="https://www.boamp.fr/pages/donnees-ouvertes-et-api/">Données ouvertes du BOAMP</a>
      </footer>
    </div>
  )
}
