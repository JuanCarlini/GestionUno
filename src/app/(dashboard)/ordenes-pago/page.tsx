import { OrdenPagoList } from "@/views/orden-pago-list"
import { CrearButton } from "@/components/crear-button"
import { PageHeader } from "@/components/page-header"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function OrdenesPagoPage() {
  await requirePagePermission("ordenes_pago", "ver")
  return (
    <div className="space-y-6">
      <PageHeader title="Órdenes de Pago" description="Gestiona las órdenes de pago a proveedores">
        <CrearButton modulo="ordenes_pago" href="/ordenes-pago/nueva" label="Nueva Orden de Pago" />
      </PageHeader>
      <OrdenPagoList />
    </div>
  )
}
