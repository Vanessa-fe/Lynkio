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
      </div>
      <Card>
        <CardContent className="pt-6">
          <SupportForm defaultName={defaults.name} defaultEmail={defaults.email} />
        </CardContent>
      </Card>
    </div>
  )
}
