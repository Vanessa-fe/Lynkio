import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StackDetectionError, detectStack } from '@/lib/detectors/stack'

/**
 * Analyse la stack d'un site avant l'enregistrement d'une entreprise (formulaire).
 * Pour une entreprise déjà enregistrée, l'action analyzeCompanyWebsite enregistre
 * directement le résultat.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
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
