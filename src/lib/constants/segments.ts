import type { CompanySegment } from '@/types'

/**
 * Segments : trois cibles qui n'achètent pas la même chose
 * (voir la migration 00026_company_segments.sql)
 */
export const SEGMENTS = ['agency', 'smb', 'startup'] as const satisfies readonly CompanySegment[]

export const segmentLabels: Record<CompanySegment, string> = {
  agency: 'Agence',
  smb: 'TPE/PME',
  startup: 'Startup/SaaS',
}

export const segmentDescriptions: Record<CompanySegment, string> = {
  agency: 'Agence web, digitale ou de communication, studio : du renfort sur ses projets clients',
  smb: 'TPE/PME dont le métier n\'est pas le numérique : un site, une refonte, un outil',
  startup: 'Startup ou éditeur de logiciel : du renfort sur son produit',
}

export const segmentTones: Record<CompanySegment, string> = {
  agency: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  smb: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  startup: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
}
