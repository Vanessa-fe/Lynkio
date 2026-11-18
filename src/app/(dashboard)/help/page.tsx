import Link from 'next/link'
import { LifeBuoy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { SupportForm } from '@/components/support/support-form'
import { supportDefaults } from '@/lib/support-defaults'

export default async function HelpPage() {
  const defaults = await supportDefaults()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <LifeBuoy className="h-7 w-7 text-primary" aria-hidden />
          Aide
        </h1>
        <p className="mt-2 text-muted-foreground">
          Une question, un problème, l&apos;abonnement : écrivez-nous, nous vous répondons par e-mail. Pour proposer
          une idée ou une amélioration, passez plutôt par la{' '}
          <Link href="/ideas" className="text-primary underline-offset-4 hover:underline">
            boîte à idées
          </Link>
          .
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <SupportForm defaultName={defaults.name} defaultEmail={defaults.email} />
        </CardContent>
      </Card>
    </div>
  )
}
