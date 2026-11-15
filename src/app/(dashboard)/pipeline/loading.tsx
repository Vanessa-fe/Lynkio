import { LoadingRegion, Skeleton } from '@/components/ui/skeleton'

// Même silhouette que le tableau : titre, compteurs, colonnes
export default function PipelineLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-xl">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[28rem] w-72 shrink-0 rounded-2xl" />
        ))}
      </div>
    </LoadingRegion>
  )
}
