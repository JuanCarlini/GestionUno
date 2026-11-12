import { PageHeaderSkeleton, ListSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <ListSkeleton />
    </div>
  )
}
