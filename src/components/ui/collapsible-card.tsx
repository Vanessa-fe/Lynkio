import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface CollapsibleCardProps {
  title: string
  description: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

// Carte repliable en <details> natif : seul l'en-tête reste visible tant qu'on ne l'ouvre pas
export function CollapsibleCard({ title, description, defaultOpen = false, children }: CollapsibleCardProps) {
  return (
    <Card>
      <details className="group" open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-center gap-4 rounded-2xl pr-6 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <CardHeader className="flex-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform duration-200 group-open:rotate-180">
            <ChevronDown className="size-4" aria-hidden="true" />
          </span>
        </summary>
        {children}
      </details>
    </Card>
  )
}
