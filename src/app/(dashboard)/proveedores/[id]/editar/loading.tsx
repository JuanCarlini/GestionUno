import { VolverSkeleton, FormSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div className="space-y-6">
      <VolverSkeleton />
      <FormSkeleton />
    </div>
  )
}
