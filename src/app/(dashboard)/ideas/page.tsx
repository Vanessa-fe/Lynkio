import { Lightbulb } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedbackForm } from '@/components/feedback/feedback-form'
import Link from 'next/link'
import { FEEDBACK_KIND_LABELS } from '@/lib/validations/feedback'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

export default async function IdeasPage() {
  const user = await getAuthUser()
  const supabase = await createClient()
  const { data: sent } = user
    ? await supabase
        .from('feedback')
        .select('id, kind, message, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [] }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Lightbulb className="h-7 w-7 text-amber-500" aria-hidden />
          Boîte à idées
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Un problème ?{' '}
          <Link href="/help" className="text-primary underline-offset-4 hover:underline">
            Passez par l&apos;aide
          </Link>
        </p>
      </div>

      <FeedbackForm />

      {(sent ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vos messages</CardTitle>
            <CardDescription>Les derniers que vous avez envoyés.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {(sent ?? []).map((item) => (
                <li key={item.id} className="py-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {FEEDBACK_KIND_LABELS[item.kind] ?? item.kind} ·{' '}
                    {dateFormat.format(new Date(item.created_at))}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{item.message}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
