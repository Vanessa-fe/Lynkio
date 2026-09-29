import { NextResponse } from 'next/server'
import { StackDetectionError, detectStack } from '@/lib/detectors/stack'
import { getAuthUser } from '@/lib/supabase/auth'

/**
 * Analyse la stack d'un site avant l'enregistrement d'une entreprise (formulaire).
 * Pour une entreprise déjà enregistrée, l'action analyzeCompanyWebsite enregistre
 * directement le résultat.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const url = body && typeof body.url === 'string' ? body.url : null

    if (!url) {
      return NextResponse.json({ error: 'L\'URL est requise' }, { status: 400 })
    }

    return NextResponse.json(await detectStack(url))
  } catch (error) {
    if (error instanceof StackDetectionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Detect stack error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
