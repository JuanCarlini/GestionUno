import { FacturaForm } from "@/views/factura-form"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function NuevaFacturaPage() {
  await requirePagePermission("facturas", "crear", "/facturas")
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Nueva Factura</h1>
        <p className="text-muted-foreground">Crea una nueva factura de proveedor</p>
      </div>
      
      <FacturaForm />
    </div>
  )
}
