import { CertificacionDetail } from "@/views/certificacion-detail"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function CertificacionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("certificaciones", "ver")
  return <CertificacionDetail params={params} />
}
