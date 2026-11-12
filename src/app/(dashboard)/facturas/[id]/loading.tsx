import { PageHeaderSkeleton, DetailSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <DetailSkeleton />
    </div>
  )
}
