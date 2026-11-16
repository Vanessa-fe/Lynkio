/**
 * Lecture côté application d'une analyse approfondie (company_deep_analyses, écrite par la fonction
 * company-deep-dive ; format DeepDiveResult dans supabase/functions/_shared/deep-dive.ts).
 * Le JSON vient de la base : chaque champ est revérifié avant d'être affiché.
 */

export type DeepAnalysisFinding = {
  event: string
  eventLabel: string
  title: string
  date: string | null
  sourceUrl: string | null
  summary: string
  relevance: string
  service: string
  confidence: 'high' | 'medium' | 'low'
  retained: boolean
  rejection: string | null
}

export type DeepAnalysisView = {
  id: string
  status: 'running' | 'done' | 'failed'
  startedAt: string
  finishedAt: string | null
  error: string | null
  signalsAdded: number
  identity: { confirmed: boolean; explanation: string; officialWebsite: string | null } | null
  summary: string
  findings: DeepAnalysisFinding[]
  // Analyse aboutie depuis moins de DEEP_ANALYSIS_CACHE_DAYS jours (calculé côté serveur)
  isFresh: boolean
}

/** Jours pendant lesquels une analyse sert de cache (même valeur que la fonction company-deep-dive) */
export const DEEP_ANALYSIS_CACHE_DAYS = 30

const string = (value: unknown, max = 400) => (typeof value === 'string' ? value.slice(0, max) : '')

function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export function readDeepAnalysis(row: {
  id: string
  status: string
  started_at: string
  finished_at: string | null
  error: string | null
  signals_added: number
  result: unknown
}, now: number = Date.now()): DeepAnalysisView {
  const result = (row.result && typeof row.result === 'object' ? row.result : {}) as Record<string, unknown>
  const identity = (result.identity && typeof result.identity === 'object' ? result.identity : null) as Record<
    string,
    unknown
  > | null
  const findings = (Array.isArray(result.findings) ? result.findings : [])
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      event: string(item.event, 60),
      eventLabel: string(item.eventLabel, 120),
      title: string(item.title, 200),
      date: typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null,
      sourceUrl: item.sourceVerified === true ? httpUrl(item.sourceUrl) : null,
      summary: string(item.summary),
      relevance: string(item.relevance, 300),
      service: string(item.service, 80),
      confidence: (item.confidence === 'high' || item.confidence === 'medium' ? item.confidence : 'low') as
        | 'high'
        | 'medium'
        | 'low',
      retained: item.retained === true,
      rejection: typeof item.rejection === 'string' ? item.rejection.slice(0, 200) : null,
    }))
    .filter((finding) => finding.title)

  return {
    id: row.id,
    status: row.status === 'done' || row.status === 'failed' ? row.status : 'running',
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
    signalsAdded: row.signals_added,
    identity: identity
      ? {
          confirmed: identity.confirmed === true,
          explanation: string(identity.explanation, 300),
          officialWebsite: httpUrl(identity.officialWebsite),
        }
      : null,
    summary: string(result.summary),
    findings,
    isFresh: row.status === 'done' && now - Date.parse(row.started_at) < DEEP_ANALYSIS_CACHE_DAYS * 86_400_000,
  }
}
