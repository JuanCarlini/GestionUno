import { FacturaDetail } from "@/views/factura-detail"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function FacturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("facturas", "ver")
  return <FacturaDetail params={params} />
}
