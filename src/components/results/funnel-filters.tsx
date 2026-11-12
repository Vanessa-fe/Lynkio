'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FUNNEL_PERIODS } from '@/lib/funnel'
import type { FunnelFilters as Filters, FunnelPageData } from '@/lib/queries/funnel'

/** Filtres de l'entonnoir, gardés dans l'adresse (partageables, vérifiables) */
export function FunnelFilters({ filters, options }: { filters: Filters; options: FunnelPageData['options'] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const set = (key: keyof Filters, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value === 'all' && key !== 'period') next.delete(key)
    else next.set(key, value)
    router.push(`${pathname}?${next.toString()}`)
  }

  const strategyLabel =
    filters.strategy === 'all'
      ? 'Toutes les recherches'
      : filters.strategy === 'none'
        ? 'Hors recherche'
        : (options.strategies.find((strategy) => strategy.id === filters.strategy)?.name ?? 'Toutes les recherches')

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Select value={filters.period} onValueChange={(value) => set('period', value)}>
        <SelectTrigger aria-label="Période">
          <SelectValue>{FUNNEL_PERIODS.find((period) => period.value === filters.period)?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FUNNEL_PERIODS.map((period) => (
            <SelectItem key={period.value} value={period.value}>
              {period.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.strategy} onValueChange={(value) => set('strategy', value)}>
        <SelectTrigger aria-label="Recherche">
          <SelectValue>{strategyLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes les recherches</SelectItem>
          {options.strategies.map((strategy) => (
            <SelectItem key={strategy.id} value={strategy.id}>
              {strategy.name}
            </SelectItem>
          ))}
          <SelectItem value="none">Hors recherche</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.source} onValueChange={(value) => set('source', value)}>
        <SelectTrigger aria-label="Source">
          <SelectValue>{options.sources.find((source) => source.id === filters.source)?.name ?? 'Toutes les sources'}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes les sources</SelectItem>
          {options.sources.map((source) => (
            <SelectItem key={source.id} value={source.id}>
              {source.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.sector} onValueChange={(value) => set('sector', value)}>
        <SelectTrigger aria-label="Secteur">
          <SelectValue>{options.sectors.find((sector) => sector.key === filters.sector)?.label ?? 'Tous les secteurs'}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les secteurs</SelectItem>
          {options.sectors.map((sector) => (
            <SelectItem key={sector.key} value={sector.key}>
              {sector.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
