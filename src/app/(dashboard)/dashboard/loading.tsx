import { PageHeaderSkeleton, DashboardSkeleton } from "@/components/skeletons"

// La page dibuja un PageHeader, asi que el skeleton tambien: sin el, al cargar aparecia el
// titulo y empujaba todo hacia abajo.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton conAccion={false} />
      <DashboardSkeleton />
    </div>
  )
}
