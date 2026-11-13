import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { captureServerError, captureServerEvent } from '@/lib/posthog-server'

/**
 * Export complet du compte (droit d'accès et portabilité, RGPD art. 15 et 20) : toutes les données
 * du compte, table par table, dans un fichier JSON. Lecture avec la session de l'utilisateur :
 * la sécurité de la base (RLS) ne laisse sortir que ses propres lignes.
 *
 * Jamais exportés : les clés personnelles (seulement le service et les 4 derniers caractères) et
 * les identifiants Stripe internes.
 */

// Tables à exporter et colonnes lues (« * » : toutes)
const TABLES: { table: string; columns: string; owner?: 'id' }[] = [
  { table: 'user_profiles', columns: '*', owner: 'id' },
  { table: 'prospection_settings', columns: '*' },
  { table: 'icp_profiles', columns: '*' },
  { table: 'prospect_strategies', columns: '*' },
  { table: 'pipeline_stages', columns: '*' },
  { table: 'lead_sources', columns: '*' },
  { table: 'portfolio_references', columns: '*' },
  { table: 'companies', columns: '*' },
  { table: 'company_contacts', columns: '*' },
  { table: 'company_interactions', columns: '*' },
  { table: 'company_signals', columns: '*' },
  { table: 'company_qualifications', columns: '*' },
  { table: 'company_stage_events', columns: '*' },
  { table: 'prospect_lists', columns: '*' },
  { table: 'prospect_list_members', columns: '*' },
  { table: 'reminders', columns: '*' },
  { table: 'linkedin_posts', columns: '*' },
  { table: 'linkedin_sequences', columns: '*' },
  { table: 'linkedin_automation', columns: '*' },
  { table: 'unidentified_job_offers', columns: '*' },
  { table: 'pipeline_runs', columns: '*' },
  { table: 'sophie_preferences', columns: '*' },
  { table: 'sophie_notifications', columns: '*' },
  { table: 'feedback', columns: '*' },
  { table: 'billing', columns: 'plan, billing_interval, status, trial_ends_at, current_period_end, cancel_at_period_end, updated_at' },
  { table: 'user_api_keys', columns: 'provider, key_hint, model, created_at, updated_at' },
  { table: 'data_retention_settings', columns: '*' },
  { table: 'data_access_log', columns: 'action, details, created_at' },
]

const PAGE_SIZE = 1000

// Nom de table dynamique : le client typé ne peut pas le vérifier, on décrit juste ce qui sert ici
type UntypedQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
    }
  }
}
type UntypedClient = { from: (table: string) => UntypedQuery }

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = await createClient()
  const data: Record<string, unknown[]> = {}

  try {
    for (const { table, columns, owner } of TABLES) {
      const rows: unknown[] = []
      // Par pages : l'API limite le nombre de lignes par requête
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data: page, error } = await (supabase as unknown as UntypedClient)
          .from(table)
          .select(columns)
          .eq(owner ?? 'user_id', user.id)
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw new Error(`${table}: ${error.message}`)
        rows.push(...(page ?? []))
        if (!page || page.length < PAGE_SIZE) break
      }
      data[table] = rows
    }
  } catch (error) {
    captureServerError(error, user.id, { action: 'export_account' })
    return NextResponse.json({ error: 'Export impossible pour le moment : réessayez, ou écrivez-nous.' }, { status: 500 })
  }

  const counts = { companies: data.companies?.length ?? 0, contacts: data.company_contacts?.length ?? 0 }
  await supabase.rpc('log_my_data_access', { p_action: 'export_account', p_details: counts })
  captureServerEvent(user.id, 'account_exported', counts)

  const exportedAt = new Date().toISOString()
  const body = JSON.stringify({ exported_at: exportedAt, account: { id: user.id, email: user.email }, data }, null, 2)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="filonea-mes-donnees-${exportedAt.slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
