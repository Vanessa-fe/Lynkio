'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { StackDetectionError, analyzeSite } from '@/lib/detectors/stack'
import { reserveWebsiteAudit } from '@/lib/detectors/audit-limit'
import { findSirenOnSite, isValidSiren } from '@/lib/detectors/legal-id'
import { fetchRegistryRecord, searchRegistryByName } from '@/lib/registry'
import {
  blockedReason,
  classifyLookupQuery,
  headcountLabel,
  siteNameFromHtml,
  type RegistryRecord,
} from '@/lib/registry-parse'
import type { DetectableTechnology } from '@/lib/constants/technologies'

/**
 * Recherche d'une entreprise à l'ajout manuel : à partir d'un nom, d'un SIREN ou
 * d'un site, Sophie propose les fiches du registre officiel (gratuit, sans IA)
 * pour pré-remplir le formulaire. Rien n'est enregistré ici.
 */

export type CompanyLookupCandidate = RegistryRecord & {
  blockedReason: string | null
  headcountLabel: string | null
  // Déjà dans les entreprises de l'utilisatrice
  existing: { id: string; name: string } | null
}

export type CompanyLookupResult = {
  source: 'siren' | 'website' | 'name'
  candidates: CompanyLookupCandidate[]
  // Explication affichée au-dessus des résultats (ex. : SIREN absent du site)
  note: string | null
  // Site lu (adresse finale) et technologies repérées, quand la recherche part d'un site
  website: string | null
  detectedStack: DetectableTechnology[] | null
}

type ActionResult<T> = { success: boolean; error?: string; data?: T }

const MAX_LOOKUPS_PER_HOUR = 60
const REGISTRY_DOWN = 'Le registre officiel ne répond pas. Réessayez dans un instant.'

// « atelier-dupont.fr » → « atelier dupont » : nom à chercher sans lire le site
function nameFromDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const label = host.split('.').slice(0, -1).join(' ').replace(/[-_]+/g, ' ').trim()
    return label.length >= 2 ? label : null
  } catch {
    return null
  }
}

export async function lookupCompany(query: string): Promise<ActionResult<CompanyLookupResult>> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const parsed = classifyLookupQuery(typeof query === 'string' ? query : '')
    if (parsed.kind === 'empty' || (parsed.kind === 'name' && parsed.name.length < 2)) {
      return { success: false, error: 'Tapez le nom de l’entreprise, son SIREN ou son site' }
    }
    if (parsed.kind === 'siren' && !isValidSiren(parsed.siren)) {
      return { success: false, error: 'Ce numéro n’est pas un SIREN valide' }
    }

    const supabase = await createClient()
    const { data: allowed, error: limitError } = await supabase.rpc('hit_my_rate_limit', {
      p_action: 'company_lookup',
      p_max: MAX_LOOKUPS_PER_HOUR,
      p_window_seconds: 3600,
    })
    if (limitError) return { success: false, error: 'Impossible de lancer la recherche pour le moment' }
    if (!allowed) return { success: false, error: 'Trop de recherches en une heure. Réessayez un peu plus tard.' }

    let records: RegistryRecord[] | null = null
    let note: string | null = null
    let website: string | null = null
    let detectedStack: DetectableTechnology[] | null = null

    if (parsed.kind === 'siren') {
      const record = await fetchRegistryRecord(parsed.siren)
      records = record ? [record] : []
    } else if (parsed.kind === 'name') {
      records = await searchRegistryByName(parsed.name)
    } else {
      // Site : SIREN des mentions légales (robots.txt respecté), sinon recherche par nom
      website = parsed.url
      let searchName: string | null = null
      try {
        await reserveWebsiteAudit()
        const site = await analyzeSite(parsed.url)
        website = site.url
        detectedStack = site.detected
        const siren = await findSirenOnSite(site.url, site.html)
        const record = siren ? await fetchRegistryRecord(siren) : null
        if (record) records = [record]
        else searchName = siteNameFromHtml(site.html) ?? nameFromDomain(site.url)
        if (!record) note = 'Pas de SIREN dans les mentions légales du site : voici les entreprises au nom proche. Vérifiez avant de choisir.'
      } catch (error) {
        if (!(error instanceof StackDetectionError)) throw error
        // Site illisible ou lecture refusée (robots.txt, quota) : on cherche par le nom de domaine
        searchName = nameFromDomain(parsed.url)
        note = `Site non lu (${error.message.replace(/\.$/, '')}) : voici les entreprises au nom proche du domaine. Vérifiez avant de choisir.`
      }
      if (!records && searchName) records = await searchRegistryByName(searchName)
      if (!records && !searchName) records = []
    }

    if (!records) return { success: false, error: REGISTRY_DOWN }

    // Entreprises déjà suivies : on propose d'ouvrir la fiche plutôt qu'un doublon
    const sirens = records.map((record) => record.siren)
    const existing = new Map<string, { id: string; name: string }>()
    if (sirens.length > 0) {
      const { data } = await supabase
        .from('companies')
        .select('id, name, registration_id')
        .eq('user_id', user.id)
        .in('registration_id', sirens)
      for (const row of data ?? []) {
        if (row.registration_id) existing.set(row.registration_id, { id: row.id, name: row.name })
      }
    }

    return {
      success: true,
      data: {
        source: parsed.kind,
        note,
        website,
        detectedStack,
        candidates: records.map((record) => {
          const reason = blockedReason(record)
          // Opposition ou données masquées : ni adresse, ni chiffres, ni dirigeants
          const shown = reason ? { ...record, address: null, finances: null, directors: [] } : record
          return {
          ...shown,
          blockedReason: reason,
          headcountLabel: headcountLabel(record.headcountCode),
          existing: existing.get(record.siren) ?? null,
          }
        }),
      },
    }
  } catch (error) {
    console.error('Company lookup error:', error)
    return { success: false, error: 'La recherche a échoué. Réessayez dans un instant.' }
  }
}
