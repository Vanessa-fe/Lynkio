import { NextResponse, type NextRequest } from 'next/server'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { normalizeLinkedinProfileUrl } from '@/lib/validations/company'
import { getWaalaxyContacts } from '@/lib/queries/waalaxy'

/**
 * Export pour Waalaxy : une personne par ligne, avec l'adresse de son profil
 * LinkedIn (colonne « URL LinkedIn », obligatoire) et son e-mail s'il est connu.
 * Seuls les contacts des entreprises en cours (étapes « ouvertes »), qui ne se
 * sont pas opposés à la prospection, sont exportés ; avec ?list=…, ceux de la liste.
 * Séparateur virgule, format CSV standard.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const supabase = await createClient()

  // ?list=… : seulement les personnes de cette liste
  const listId = request.nextUrl.searchParams.get('list')
  let listName: string | null = null
  if (listId) {
    const { data: list } = await supabase
      .from('prospect_lists')
      .select('name')
      .eq('id', listId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!list) return NextResponse.json({ error: 'Liste introuvable' }, { status: 404 })
    listName = list.name
  }

  const contacts = await getWaalaxyContacts(supabase, user.id, listId ?? undefined)

  const rows = contacts
    .map((contact) => ({
      'URL LinkedIn': normalizeLinkedinProfileUrl(contact.linkedin_url),
      Email: contact.email ?? '',
    }))
    .filter((row) => row['URL LinkedIn'])

  const csv = Papa.unparse(rows, { columns: ['URL LinkedIn', 'Email'] })
  const date = new Date().toISOString().slice(0, 10)
  const slug = listName
    ? `-${listName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
    : ''

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lynkio-waalaxy${slug}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
