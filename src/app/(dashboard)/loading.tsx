import { LoadingRegion, Skeleton } from '@/components/ui/skeleton'

/**
 * Affiché dès le clic sur un lien, le temps que la page arrive du serveur :
 * la navigation paraît immédiate au lieu de sembler ne rien faire.
 */
export default function DashboardLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </LoadingRegion>
  )
}
