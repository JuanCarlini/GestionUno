import { FacturaForm } from "@/views/factura-form"
import { PageHeader } from "@/components/page-header"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function NuevaFacturaPage() {
  await requirePagePermission("facturas", "crear", "/facturas")
  return (
    <div className="space-y-6">
      <PageHeader title="Nueva Factura" description="Crea una nueva factura de proveedor" />

      <FacturaForm />
    </div>
  )
}
