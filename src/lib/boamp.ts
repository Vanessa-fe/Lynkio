const endpoint = 'https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records'
const pageSize = 10
const fields = 'idweb,objet,nomacheteur,url_avis,dateparution,datelimitereponse,etat,code_departement,code_departement_prestation,donnees'
export type Filters = { service: string; buyer: string; cpv: string; department: string; zone: string; days: string }
export type Notice = {
  idweb: string; objet: string; nomacheteur: string; url_avis: string; dateparution: string
  datelimitereponse: string; etat: string; code_departement: string[] | null
  code_departement_prestation: string[] | null; donnees: string | null
}
type Reference = { annonce_lie: string[] | null; annonces_anterieures: string[] | null }
const idPattern = /^\d{2}-\d+$/
const cpvPattern = /^\d{8}$/
const departmentPattern = /^(?:0?[1-9]|[1-9]\d|2[AB]|97\d|98\d)$/

export function filterError(f: Filters) {
  if (f.cpv && !cpvPattern.test(f.cpv)) return 'Saisissez les huit chiffres du code CPV.'
  if (!['publication', 'prestation'].includes(f.zone)) return 'Choisissez une zone proposée.'
  if (f.department && !departmentPattern.test(f.department)) return 'Vérifiez le code du département.'
  if (![f.service, f.buyer].every(t => t.length <= 80 && (!t || /^[\p{L}\p{N}\s’'&.,()/+-]+$/u.test(t)))) {
    return 'Utilisez un intitulé de prestation ou d’organisme de 80 caractères maximum, sans caractères spéciaux.'
  }
  if (!['', '7', '30', '90'].includes(f.days)) return 'Choisissez un délai proposé.'
  return null
}

function recordsUrl(where: string, select: string, limit: number) {
  const url = new URL(endpoint)
  url.search = new URLSearchParams({ where, select, limit: String(limit) }).toString()
  return url
}

export function searchUrl(f: Filters, page: number, now: Date) {
  if (filterError(f) || !Number.isInteger(page) || page < 1 || page > 1000) throw new Error('Filtres invalides')
  const clauses = ["nature='APPEL_OFFRE'", "type_marche='SERVICES'", 'datelimitereponse > now()']
  if (f.days) {
    const until = new Date(now.getTime() + Number(f.days) * 86_400_000)
    clauses.push("datelimitereponse <= date'" + until.toISOString() + "'")
  }
  if (f.service) clauses.push('(search(objet,' + JSON.stringify(f.service) + ') or search(descripteur_libelle,' + JSON.stringify(f.service) + '))')
  if (f.buyer) clauses.push('search(nomacheteur,' + JSON.stringify(f.buyer) + ')')
  if (f.cpv) clauses.push('search(donnees,' + JSON.stringify(f.cpv) + ')')
  if (f.department) {
    // Le BOAMP indexe aussi les départements 01 à 09 sans zéro initial.
    const zone = JSON.stringify(f.department.replace(/^0/, ''))
    const field = f.zone === 'prestation' ? 'code_departement_prestation' : 'code_departement'
    clauses.push(field + ' in (' + zone + ',' + JSON.stringify(f.department.padStart(2, '0')) + ')')
  }
  const url = recordsUrl(clauses.join(' and '), fields, pageSize)
  url.searchParams.set('order_by', 'dateparution desc,idweb desc')
  url.searchParams.set('offset', String((page - 1) * pageSize))
  return url
}

export function noticeDetails(raw: string | null) {
  const codes = new Set<string>()
  let solo: string | undefined
  let reservedLot = false
  function walk(value: unknown, parent = '') {
    if (Array.isArray(value)) { value.forEach(item => walk(item, parent)); return }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      if (record['@listName'] === 'reserved-procurement' && ['res-ws', 'res-pso'].includes(String(record['#text']))) reservedLot = true
      if (record['@listName'] === 'cpv' && typeof record['#text'] === 'string' && cpvPattern.test(record['#text'])) {
        codes.add(record['#text'])
      }
      Object.entries(record).forEach(([key, item]) => walk(item, key))
    } else if (typeof value === 'string') {
      if (/^class(?:Principale|Supplementaire)$/i.test(parent) && cpvPattern.test(value)) codes.add(value)
      const statement = value.match(/(?:^|[.!?]\s+)((?:les (?:opérateurs économiques|candidats) peuvent (?:se présenter|candidater|soumissionner) seuls? ou en groupement|la candidature individuelle est (?:admise|autorisée)))[.!](?:\s|$)/i)
      solo ??= statement?.[1]
    }
  }
  if (raw) {
    try { walk(JSON.parse(raw)) } catch { /* Certaines anciennes annonces n'ont pas de détail JSON exploitable. */ }
  }
  return { codes: [...codes], solo, reservedLot }
}

async function records<T>(url: URL): Promise<{ results: T[]; total_count: number }> {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error('BOAMP indisponible')
  const body = await response.json()
  if (!Array.isArray(body.results) || !Number.isInteger(body.total_count)) throw new Error('Réponse BOAMP incomplète')
  return body
}

export async function findNotices(filters: Filters, page: number) {
  const response = await records<Notice>(searchUrl(filters, page, new Date()))
  const ids = [...new Set(response.results.map(row => row.idweb).filter(id => idPattern.test(id)))]
  const superseded = new Set<string>()
  if (ids.length) {
    // Vérifier hors des filtres : un rectificatif, une annulation ou une attribution
    // peut référencer l'avis initial sans reprendre son CPV ni son échéance.
    const values = ids.map(id => JSON.stringify(id)).join(',')
    const links = await records<Reference>(recordsUrl(
      '(annonce_lie in (' + values + ') or annonces_anterieures in (' + values + '))',
      'annonce_lie,annonces_anterieures', 100))
    if (links.total_count > links.results.length) throw new Error('Historique BOAMP incomplet')
    for (const link of links.results) {
      for (const id of [...(link.annonce_lie ?? []), ...(link.annonces_anterieures ?? [])]) superseded.add(id)
    }
  }
  const seen = new Set<string>()
  const notices = response.results.flatMap(row => {
    if (!idPattern.test(row.idweb) || seen.has(row.idweb) || superseded.has(row.idweb)) return []
    if (!['INITIAL', 'RECTIFICATIF'].includes(row.etat) || !(Date.parse(row.datelimitereponse) > Date.now())) return []
    if (!URL.canParse(row.url_avis)) return []
    const source = new URL(row.url_avis)
    if (source.origin !== 'https://www.boamp.fr' || source.pathname !== '/pages/avis/' || source.searchParams.get('q') !== 'idweb:' + row.idweb) return []
    const details = noticeDetails(row.donnees)
    if (filters.cpv && !details.codes.includes(filters.cpv)) return []
    seen.add(row.idweb)
    return [{ idweb: row.idweb, objet: row.objet, nomacheteur: row.nomacheteur, etat: row.etat,
      url_avis: row.url_avis, datelimitereponse: row.datelimitereponse, dateparution: row.dateparution,
      code_departement_prestation: row.code_departement_prestation, ...details }]
  })
  return { notices, hasNext: page < 1000 && page * pageSize < response.total_count }
}
