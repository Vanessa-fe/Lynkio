import { NextResponse } from 'next/server'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { normalizeLinkedinProfileUrl } from '@/lib/validations/company'
import { getWaalaxyContacts } from '@/lib/queries/waalaxy'

/**
 * Export pour Waalaxy : une personne par ligne, avec l'adresse de son profil
 * LinkedIn (colonne « URL LinkedIn », obligatoire) et son e-mail s'il est connu.
 * Seuls les contacts des entreprises en cours (étapes « ouvertes »), qui ne se
 * sont pas opposés à la prospection, sont exportés. Séparateur virgule, format
 * CSV standard.
 */
export async function GET() {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const supabase = await createClient()
  const contacts = await getWaalaxyContacts(supabase, user.id)

  const rows = contacts
    .map((contact) => ({
      'URL LinkedIn': normalizeLinkedinProfileUrl(contact.linkedin_url),
      Email: contact.email ?? '',
    }))
    .filter((row) => row['URL LinkedIn'])

  const csv = Papa.unparse(rows, { columns: ['URL LinkedIn', 'Email'] })
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lynkio-waalaxy-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
