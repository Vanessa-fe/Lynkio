import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CompanyScore } from '@/components/companies/company-stage-select'
import type { DashboardOpportunity } from '@/lib/queries/prospection-dashboard'

export function TopOpportunities({ opportunities }: { opportunities: DashboardOpportunity[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Meilleures opportunités</CardTitle>
            <CardDescription>Les pistes les mieux notées que vous n&apos;avez pas encore contactées</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/companies">Toutes</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Aucune piste à contacter. Lancez une recherche dans l&apos;onglet Prospection.
          </p>
        ) : (
          <ol className="divide-y">
            {opportunities.map((company) => (
              <li key={company.id}>
                <Link
                  href={`/companies/${company.id}`}
                  className="flex items-center gap-3 py-3 rounded-md hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CompanyScore score={company.score} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{company.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {[company.topSignal, company.city].filter(Boolean).join(' · ') || company.sector || '–'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
