// Orchestration d'un passage : réglages, détecteurs, journal (pipeline_runs)

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  UserFacingError,
  errorMessage,
  newSourceStats,
  type Budget,
  type Context,
  type Settings,
  type SourceKey,
  type SourceStats,
} from './context.ts'
import { detectJobPostings } from './detect-job-postings.ts'
import { detectRecentCreations } from './detect-recent-creations.ts'
import { detectTechUsers } from './detect-tech-users.ts'
import { UNIQUE_VIOLATION } from './store.ts'

// Au-delà, un passage bloqué (fonction interrompue) est considéré comme échoué
const STALE_RUN_MINUTES = 15

// Ordre de passage : la source la plus utile consomme le quota en premier
const DETECTORS: {
  key: SourceKey
  cursorColumn: 'job_postings_cursor' | 'bodacc_cursor' | null
  detect: (
    admin: SupabaseClient,
    settings: Settings,
    context: Context,
    budget: Budget
  ) => Promise<{ stats: SourceStats; cursor: string | null }>
}[] = [
  { key: 'job_postings', cursorColumn: 'job_postings_cursor', detect: detectJobPostings },
  { key: 'recent_creations', cursorColumn: 'bodacc_cursor', detect: detectRecentCreations },
  // À la demande seulement (voir SourceKey)
  { key: 'tech_users', cursorColumn: null, detect: detectTechUsers },
]

export type StartResult = { ok: true; runId: string } | { ok: false; error: string }

/**
 * Ouvre un passage. La base garantit qu'il n'y en a qu'un en cours par utilisateur.
 */
export async function startRun(
  admin: SupabaseClient,
  userId: string,
  triggeredBy: 'manual' | 'schedule'
): Promise<StartResult> {
  const staleBefore = new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString()

  await admin
    .from('pipeline_runs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error: 'Passage interrompu avant la fin',
    })
    .eq('user_id', userId)
    .eq('status', 'running')
    .lt('started_at', staleBefore)

  const { data, error } = await admin
    .from('pipeline_runs')
    .insert({ user_id: userId, triggered_by: triggeredBy })
    .select('id')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: 'Une prospection est déjà en cours' }
    }
    console.error('startRun', error)
    return { ok: false, error: 'Impossible de démarrer la prospection' }
  }

  return { ok: true, runId: data.id }
}

/**
 * Déroule un passage : chaque source activée à tour de rôle. Une source en
 * panne n'empêche pas les autres ; le passage n'échoue que si toutes échouent.
 */
export async function runProspection(
  admin: SupabaseClient,
  userId: string,
  runId: string,
  // Sources imposées (lancement « recherche par technologie ») ; sinon celles des réglages
  only?: SourceKey[]
) {
  const results: Partial<Record<SourceKey, SourceStats>> = {}

  try {
    const settings = await loadSettings(admin, userId)
    const context = await loadContext(admin, userId)
    const budget: Budget = { remaining: settings.max_companies_per_run }
    const cursorUpdates: Record<string, string> = {}

    const sources: SourceKey[] = only ?? settings.sources.filter((source) => source !== 'tech_users')

    for (const detector of DETECTORS) {
      if (!sources.includes(detector.key)) continue

      try {
        const { stats, cursor } = await detector.detect(admin, settings, context, budget)
        results[detector.key] = stats
        if (detector.cursorColumn && cursor && cursor !== settings[detector.cursorColumn]) {
          cursorUpdates[detector.cursorColumn] = cursor
        }
      } catch (error) {
        console.error(`detector ${detector.key}`, error)
        results[detector.key] = { ...newSourceStats(), error: errorMessage(error) }
      }
    }

    if (Object.keys(cursorUpdates).length > 0) {
      await admin.from('prospection_settings').update(cursorUpdates).eq('user_id', userId)
    }

    const outcomes = Object.values(results)
    const failures = outcomes.filter((stats) => stats.error)
    const allFailed = outcomes.length > 0 && failures.length === outcomes.length

    await finishRun(
      admin,
      runId,
      allFailed ? 'failed' : 'succeeded',
      results,
      settings.departments,
      allFailed ? failures.map((stats) => stats.error).join(' · ') : undefined
    )
  } catch (error) {
    console.error('runProspection', error)
    await finishRun(admin, runId, 'failed', results, [], errorMessage(error))
  }
}

async function loadSettings(admin: SupabaseClient, userId: string): Promise<Settings> {
  const { data, error } = await admin
    .from('prospection_settings')
    .select('departments, excluded_naf_sections, max_companies_per_run, sources, bodacc_cursor, job_postings_cursor')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data || data.departments.length === 0) {
    throw new UserFacingError('Choisissez au moins un département dans les réglages de prospection')
  }
  return data as Settings
}

async function loadContext(admin: SupabaseClient, userId: string): Promise<Context> {
  const [profile, stage, source, icp] = await Promise.all([
    admin.from('user_profiles').select('profession_key').eq('id', userId).maybeSingle(),
    admin.from('pipeline_stages').select('id').eq('user_id', userId).eq('is_default', true).maybeSingle(),
    admin
      .from('lead_sources')
      .select('id')
      .eq('user_id', userId)
      .eq('name', 'Détection automatique')
      .maybeSingle(),
    admin
      .from('icp_profiles')
      .select('criteria, signal_weights')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  ])

  const keywords = icp.data?.criteria?.exclude_keywords
  const sizes = icp.data?.criteria?.size_categories
  const sizeCategories = [...(sizes?.preferred ?? []), ...(sizes?.accepted ?? [])].filter(
    (size): size is string => typeof size === 'string'
  )
  const techStack = icp.data?.criteria?.tech_stack
  const weights = icp.data?.signal_weights
  return {
    userId,
    professionKey: profile.data?.profession_key ?? null,
    stageId: stage.data?.id ?? null,
    sourceId: source.data?.id ?? null,
    excludedKeywords: Array.isArray(keywords) ? keywords.filter((k): k is string => typeof k === 'string') : [],
    signalWeights:
      weights && typeof weights === 'object'
        ? Object.fromEntries(Object.entries(weights).filter((entry): entry is [string, number] => typeof entry[1] === 'number'))
        : {},
    sizeCategories: sizeCategories.length > 0 ? sizeCategories : null,
    techStack: Array.isArray(techStack) ? techStack.filter((t): t is string => typeof t === 'string') : [],
  }
}

async function finishRun(
  admin: SupabaseClient,
  runId: string,
  status: 'succeeded' | 'failed',
  results: Partial<Record<SourceKey, SourceStats>>,
  departments: string[],
  error?: string
) {
  const outcomes = Object.values(results)
  const sum = (pick: (stats: SourceStats) => number) => outcomes.reduce((total, stats) => total + pick(stats), 0)

  const skipReasons: Record<string, number> = {}
  for (const stats of outcomes) {
    for (const [reason, count] of Object.entries(stats.skipReasons)) {
      skipReasons[reason] = (skipReasons[reason] ?? 0) + count
    }
  }

  const { error: updateError } = await admin
    .from('pipeline_runs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      companies_seen: sum((stats) => stats.seen),
      companies_created: sum((stats) => stats.created),
      companies_skipped: sum((stats) => stats.skipped),
      error: error ?? null,
      details: {
        departments,
        signals_added: sum((stats) => stats.signalsAdded),
        unidentified: sum((stats) => stats.unidentified),
        skip_reasons: skipReasons,
        created: outcomes.flatMap((stats) => stats.createdCompanies).slice(0, 100),
        sources: Object.fromEntries(
          Object.entries(results).map(([key, stats]) => [
            key,
            {
              seen: stats.seen,
              created: stats.created,
              skipped: stats.skipped,
              signals_added: stats.signalsAdded,
              unidentified: stats.unidentified,
              since: stats.since ?? null,
              until: stats.until ?? null,
              error: stats.error ?? null,
            },
          ])
        ),
      },
    })
    .eq('id', runId)

  if (updateError) console.error('finishRun', updateError)
}
