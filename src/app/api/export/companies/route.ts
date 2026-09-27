import { NextResponse } from 'next/server'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/server'
import { formatPhoneForDisplay, sizeCategoryLabels } from '@/lib/validations/company'
import { COLUMN_LABELS } from '@/lib/validations/company-import'
import type { SizeCategory } from '@/types'

type ExportedContact = {
  first_name: string | null
  last_name: string | null
  role: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  is_decision_maker: boolean
  opted_out_at: string | null
}

type ExportedSignal = { expires_at: string | null; type: { label: string } | null }

/**
 * Protection contre l'injection de formules : Excel exécute une cellule qui commence
 * par =, +, - ou @. Une apostrophe en tête la fait lire comme du texte (l'import la retire).
 */
function safeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('fr-FR') : ''
}

/**
 * Export CSV des entreprises : séparateur « ; » et BOM UTF-8, pour qu'Excel en
 * français l'ouvre directement avec les bonnes colonnes et les accents.
 * Les contacts qui se sont opposés à la prospection ne sont pas exportés.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: companies, error } = await supabase
      .from('companies')
      .select(
        `name, website, registration_id, city, postal_code, sector, size_category, founded_on, notes, score,
         origin, created_at, last_interaction_at,
         stage:pipeline_stages(name), source:lead_sources(name),
         contacts:company_contacts(first_name, last_name, role, email, phone, linkedin_url, is_decision_maker, opted_out_at),
         signals:company_signals(expires_at, type:signal_types(label))`
      )
      .eq('user_id', user.id)
      .order('score', { ascending: false, nullsFirst: false })
      .order('name')

    if (error) {
      console.error('Export companies error:', error)
      return NextResponse.json({ error: 'Impossible de lire vos entreprises' }, { status: 500 })
    }

    const now = Date.now()
    const originLabels: Record<string, string> = { manual: 'Ajoutée à la main', import: 'Import', detector: 'Sophie' }

    const rows = (companies ?? []).map((company) => {
      // Contact principal : un décideur d'abord, jamais une personne opposée à la prospection
      const contacts = ((company.contacts ?? []) as ExportedContact[]).filter((contact) => !contact.opted_out_at)
      const contact = contacts.find((item) => item.is_decision_maker) ?? contacts[0]
      const signals = ((company.signals ?? []) as ExportedSignal[])
        .filter((signal) => !signal.expires_at || new Date(signal.expires_at).getTime() > now)
        .map((signal) => signal.type?.label)
        .filter(Boolean)

      return {
        [COLUMN_LABELS.name]: safeCell(company.name),
        [COLUMN_LABELS.website]: safeCell(company.website),
        [COLUMN_LABELS.registrationId]: safeCell(company.registration_id),
        [COLUMN_LABELS.city]: safeCell(company.city),
        [COLUMN_LABELS.postalCode]: safeCell(company.postal_code),
        [COLUMN_LABELS.sector]: safeCell(company.sector),
        [COLUMN_LABELS.sizeCategory]: company.size_category
          ? sizeCategoryLabels[company.size_category as SizeCategory]
          : '',
        Création: formatDate(company.founded_on),
        Étape: safeCell((company.stage as { name: string } | null)?.name),
        Score: company.score ?? '',
        [COLUMN_LABELS.source]: safeCell((company.source as { name: string } | null)?.name),
        'Signaux en cours': safeCell([...new Set(signals)].join(', ')),
        'Dernier échange': formatDate(company.last_interaction_at),
        [COLUMN_LABELS.contactFirstName]: safeCell(contact?.first_name),
        [COLUMN_LABELS.contactLastName]: safeCell(contact?.last_name),
        [COLUMN_LABELS.contactRole]: safeCell(contact?.role),
        [COLUMN_LABELS.contactEmail]: safeCell(contact?.email),
        [COLUMN_LABELS.contactPhone]: safeCell(contact?.phone ? formatPhoneForDisplay(contact.phone) : null),
        [COLUMN_LABELS.contactLinkedin]: safeCell(contact?.linkedin_url),
        [COLUMN_LABELS.notes]: safeCell(company.notes),
        'Ajoutée le': formatDate(company.created_at),
        Origine: originLabels[company.origin] ?? company.origin,
      }
    })

    const csv = Papa.unparse(rows, { delimiter: ';' })
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(`﻿${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="prospect-entreprises-${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Export companies error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
