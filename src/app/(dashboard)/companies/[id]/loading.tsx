import { LoadingRegion, Skeleton } from '@/components/ui/skeleton'

// Même silhouette que la fiche entreprise : en-tête, informations, blocs
export default function CompanyLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <Skeleton className="h-5 w-32" />
      <div className="rounded-lg border p-6 space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </LoadingRegion>
  )
}
