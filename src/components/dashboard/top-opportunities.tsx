import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CompanyScore } from '@/components/companies/company-stage-select'
import type { DashboardOpportunity } from '@/lib/queries/prospection-dashboard'

export function TopOpportunities({ opportunities }: { opportunities: DashboardOpportunity[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Entreprises à examiner</CardTitle>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/companies?vue=tableau">Toutes</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Aucune découverte à examiner. <Link href="/prospection" className="text-primary underline-offset-2 hover:underline">Lancer une recherche</Link>
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
                  {/* Le nom seul : le détail est sur la fiche */}
                  <p className="min-w-0 flex-1 truncate font-medium">{company.name}</p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
