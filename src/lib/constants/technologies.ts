/**
 * Technologies que l'analyse de site sait reconnaître (valeurs de companies.detected_stack)
 */
export const DETECTABLE_TECHNOLOGIES = ['nextjs', 'react', 'wordpress', 'webflow'] as const
export type DetectableTechnology = (typeof DETECTABLE_TECHNOLOGIES)[number]

export const TECHNOLOGY_LABELS: Record<DetectableTechnology, string> = {
  nextjs: 'Next.js',
  react: 'React',
  wordpress: 'WordPress',
  webflow: 'Webflow',
}

export function technologyLabel(key: string): string {
  return TECHNOLOGY_LABELS[key as DetectableTechnology] ?? key
}
