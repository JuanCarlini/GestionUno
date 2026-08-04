import { FacturasList } from "@/views/facturas-list"
import { CrearButton } from "@/components/crear-button"
import { PageHeader } from "@/components/page-header"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function FacturasPage() {
  await requirePagePermission("facturas", "ver")
  return (
    <div className="space-y-6">
      <PageHeader title="Facturas" description="Gestiona las facturas de proveedores">
        <CrearButton modulo="facturas" href="/facturas/nueva" label="Nueva Factura" />
      </PageHeader>

      <FacturasList />
    </div>
  )
}
