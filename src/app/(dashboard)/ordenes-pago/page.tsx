import { OrdenPagoList } from "@/views/orden-pago-list"
import { CrearButton } from "@/components/crear-button"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function OrdenesPagoPage() {
  await requirePagePermission("ordenes_pago", "ver")
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Órdenes de Pago</h1>
          <p className="text-muted-foreground">Gestiona las órdenes de pago a proveedores</p>
        </div>
        <CrearButton modulo="ordenes_pago" href="/ordenes-pago/nueva" label="Nueva Orden de Pago" />
      </div>
      <OrdenPagoList />
    </div>
  )
}
