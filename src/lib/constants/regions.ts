/**
 * Régions françaises (découpage 2016) et leurs départements. Sert aux critères « souples » d'une
 * recherche : une zone souple s'étend aux autres départements de la même région, avec moins de points.
 * Même liste dans supabase/functions/prospection-run/detect-profile.ts (REGION_DEPARTMENTS) et dans
 * la base (public.department_region, migration 00058).
 */
export const REGION_DEPARTMENTS: Record<string, { label: string; departments: string[] }> = {
  ARA: { label: 'Auvergne-Rhône-Alpes', departments: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'] },
  BFC: { label: 'Bourgogne-Franche-Comté', departments: ['21', '25', '39', '58', '70', '71', '89', '90'] },
  BRE: { label: 'Bretagne', departments: ['22', '29', '35', '56'] },
  CVL: { label: 'Centre-Val de Loire', departments: ['18', '28', '36', '37', '41', '45'] },
  COR: { label: 'Corse', departments: ['2A', '2B'] },
  GES: { label: 'Grand Est', departments: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'] },
  HDF: { label: 'Hauts-de-France', departments: ['02', '59', '60', '62', '80'] },
  IDF: { label: 'Île-de-France', departments: ['75', '77', '78', '91', '92', '93', '94', '95'] },
  NOR: { label: 'Normandie', departments: ['14', '27', '50', '61', '76'] },
  NAQ: { label: 'Nouvelle-Aquitaine', departments: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'] },
  OCC: { label: 'Occitanie', departments: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'] },
  PDL: { label: 'Pays de la Loire', departments: ['44', '49', '53', '72', '85'] },
  PAC: { label: 'Provence-Alpes-Côte d’Azur', departments: ['04', '05', '06', '13', '83', '84'] },
  GUA: { label: 'Guadeloupe', departments: ['971'] },
  MTQ: { label: 'Martinique', departments: ['972'] },
  GUF: { label: 'Guyane', departments: ['973'] },
  LRE: { label: 'La Réunion', departments: ['974'] },
  MAY: { label: 'Mayotte', departments: ['976'] },
}

const REGION_OF = new Map(
  Object.entries(REGION_DEPARTMENTS).flatMap(([region, { departments }]) => departments.map((code) => [code, region] as const))
)

export function regionOfDepartment(code: string): string | null {
  return REGION_OF.get(code) ?? null
}

/** Départements choisis + ceux des mêmes régions (zone souple), sans doublon */
export function expandToRegions(departments: string[]): string[] {
  const regions = new Set(departments.map(regionOfDepartment).filter((region): region is string => !!region))
  return [...new Set([...departments, ...[...regions].flatMap((region) => REGION_DEPARTMENTS[region]!.departments)])]
}
