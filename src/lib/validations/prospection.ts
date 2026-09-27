import { z } from 'zod'

/**
 * Réglages de la prospection automatique (Sophie)
 */

// Départements français (code INSEE → nom), dans l'ordre des codes
export const DEPARTMENTS: Record<string, string> = {
  '01': 'Ain',
  '02': 'Aisne',
  '03': 'Allier',
  '04': 'Alpes-de-Haute-Provence',
  '05': 'Hautes-Alpes',
  '06': 'Alpes-Maritimes',
  '07': 'Ardèche',
  '08': 'Ardennes',
  '09': 'Ariège',
  '10': 'Aube',
  '11': 'Aude',
  '12': 'Aveyron',
  '13': 'Bouches-du-Rhône',
  '14': 'Calvados',
  '15': 'Cantal',
  '16': 'Charente',
  '17': 'Charente-Maritime',
  '18': 'Cher',
  '19': 'Corrèze',
  '2A': 'Corse-du-Sud',
  '2B': 'Haute-Corse',
  '21': "Côte-d'Or",
  '22': "Côtes-d'Armor",
  '23': 'Creuse',
  '24': 'Dordogne',
  '25': 'Doubs',
  '26': 'Drôme',
  '27': 'Eure',
  '28': 'Eure-et-Loir',
  '29': 'Finistère',
  '30': 'Gard',
  '31': 'Haute-Garonne',
  '32': 'Gers',
  '33': 'Gironde',
  '34': 'Hérault',
  '35': 'Ille-et-Vilaine',
  '36': 'Indre',
  '37': 'Indre-et-Loire',
  '38': 'Isère',
  '39': 'Jura',
  '40': 'Landes',
  '41': 'Loir-et-Cher',
  '42': 'Loire',
  '43': 'Haute-Loire',
  '44': 'Loire-Atlantique',
  '45': 'Loiret',
  '46': 'Lot',
  '47': 'Lot-et-Garonne',
  '48': 'Lozère',
  '49': 'Maine-et-Loire',
  '50': 'Manche',
  '51': 'Marne',
  '52': 'Haute-Marne',
  '53': 'Mayenne',
  '54': 'Meurthe-et-Moselle',
  '55': 'Meuse',
  '56': 'Morbihan',
  '57': 'Moselle',
  '58': 'Nièvre',
  '59': 'Nord',
  '60': 'Oise',
  '61': 'Orne',
  '62': 'Pas-de-Calais',
  '63': 'Puy-de-Dôme',
  '64': 'Pyrénées-Atlantiques',
  '65': 'Hautes-Pyrénées',
  '66': 'Pyrénées-Orientales',
  '67': 'Bas-Rhin',
  '68': 'Haut-Rhin',
  '69': 'Rhône',
  '70': 'Haute-Saône',
  '71': 'Saône-et-Loire',
  '72': 'Sarthe',
  '73': 'Savoie',
  '74': 'Haute-Savoie',
  '75': 'Paris',
  '76': 'Seine-Maritime',
  '77': 'Seine-et-Marne',
  '78': 'Yvelines',
  '79': 'Deux-Sèvres',
  '80': 'Somme',
  '81': 'Tarn',
  '82': 'Tarn-et-Garonne',
  '83': 'Var',
  '84': 'Vaucluse',
  '85': 'Vendée',
  '86': 'Vienne',
  '87': 'Haute-Vienne',
  '88': 'Vosges',
  '89': 'Yonne',
  '90': 'Territoire de Belfort',
  '91': 'Essonne',
  '92': 'Hauts-de-Seine',
  '93': 'Seine-Saint-Denis',
  '94': 'Val-de-Marne',
  '95': "Val-d'Oise",
  '971': 'Guadeloupe',
  '972': 'Martinique',
  '973': 'Guyane',
  '974': 'La Réunion',
  '976': 'Mayotte',
}

// Liste ordonnée pour l'affichage. On ne peut pas se fier à l'ordre des clés
// de DEPARTMENTS : JavaScript range les clés numériques (« 10 », « 69 ») avant
// les autres (« 01 », « 2A »). La Corse (2A, 2B) prend la place de l'ancien 20.
function departmentSortKey(code: string): number {
  if (code === '2A') return 20.1
  if (code === '2B') return 20.2
  return Number(code)
}

export const DEPARTMENT_LIST = Object.entries(DEPARTMENTS).sort(
  ([a], [b]) => departmentSortKey(a) - departmentSortKey(b)
)

// Sections de la nomenclature d'activités (NAF), telles qu'utilisées par Sophie
export const NAF_SECTIONS: Record<string, string> = {
  A: 'Agriculture, sylviculture et pêche',
  B: 'Industries extractives',
  C: 'Industrie manufacturière',
  D: 'Énergie',
  E: 'Eau, déchets et dépollution',
  F: 'Construction',
  G: 'Commerce',
  H: 'Transports et entreposage',
  I: 'Hébergement et restauration',
  J: 'Information et communication',
  K: 'Finance, assurance et holdings',
  L: 'Immobilier (dont SCI)',
  M: 'Activités spécialisées, scientifiques et techniques',
  N: 'Services administratifs et de soutien',
  O: 'Administration publique',
  P: 'Enseignement',
  Q: 'Santé et action sociale',
  R: 'Arts, spectacles et loisirs',
  S: 'Autres services',
  T: 'Activités des ménages',
  U: 'Organisations extraterritoriales',
}

// Jours ISO : 1 = lundi … 7 = dimanche (même convention que la base)
export const WEEK_DAYS = [
  { value: 1, short: 'Lun', label: 'lundi' },
  { value: 2, short: 'Mar', label: 'mardi' },
  { value: 3, short: 'Mer', label: 'mercredi' },
  { value: 4, short: 'Jeu', label: 'jeudi' },
  { value: 5, short: 'Ven', label: 'vendredi' },
  { value: 6, short: 'Sam', label: 'samedi' },
  { value: 7, short: 'Dim', label: 'dimanche' },
] as const

export const RUN_HOURS = Array.from({ length: 15 }, (_, index) => index + 6) // 6 h à 20 h

export const MAX_COMPANIES_OPTIONS = [5, 10, 20, 30, 50] as const

// Sources de Sophie, dans l'ordre où elle les consulte
export const PROSPECTION_SOURCES = [
  {
    key: 'job_postings',
    label: 'Entreprises qui recrutent un développeur',
    description:
      'Offres d\'emploi publiées sur France Travail. Une entreprise qui recrute a un besoin et un budget : elle peut préférer un freelance en attendant, ou en complément.',
  },
  {
    key: 'recent_creations',
    label: 'Sociétés tout juste créées',
    description:
      'Immatriculations publiées au BODACC. Elles ont besoin de tout, mais rarement d\'un gros budget.',
  },
] as const

export type ProspectionSourceKey = (typeof PROSPECTION_SOURCES)[number]['key']
const sourceKeys = PROSPECTION_SOURCES.map((source) => source.key) as [ProspectionSourceKey, ...ProspectionSourceKey[]]

export const prospectionSettingsSchema = z
  .object({
    isActive: z.boolean(),
    daysOfWeek: z
      .array(z.number().int().min(1).max(7))
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    runHour: z.number().int().min(0).max(23),
    departments: z
      .array(z.string().refine((code) => code in DEPARTMENTS, 'Département inconnu'))
      .max(20, 'Choisissez au plus 20 départements')
      .transform((codes) => [...new Set(codes)]),
    excludedNafSections: z.array(z.string().refine((code) => code in NAF_SECTIONS, 'Secteur inconnu')),
    maxCompaniesPerRun: z.number().int().min(1).max(100),
    sources: z
      .array(z.enum(sourceKeys))
      .min(1, 'Choisissez au moins une source')
      .transform((keys) => [...new Set(keys)]),
  })
  .refine((data) => !data.isActive || data.daysOfWeek.length > 0, {
    message: 'Choisissez au moins un jour pour la prospection automatique',
    path: ['daysOfWeek'],
  })
  .refine((data) => !data.isActive || data.departments.length > 0, {
    message: 'Choisissez au moins un département pour la prospection automatique',
    path: ['departments'],
  })

export type ProspectionSettingsInput = z.input<typeof prospectionSettingsSchema>

/**
 * Valeurs affichées quand l'utilisateur n'a encore rien enregistré
 * (identiques aux valeurs par défaut de la table prospection_settings)
 */
export const DEFAULT_PROSPECTION_SETTINGS: ProspectionSettingsInput = {
  isActive: false,
  daysOfWeek: [1, 4],
  runHour: 9,
  departments: [],
  excludedNafSections: ['K', 'L', 'O', 'T', 'U'],
  maxCompaniesPerRun: 20,
  sources: ['job_postings'],
}
