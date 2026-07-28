import { ProveedorDetailClient } from "@/views/proveedor-detail-client"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function ProveedorDetailsPage() {
  await requirePagePermission("proveedores", "ver")
  return <ProveedorDetailClient />
}
