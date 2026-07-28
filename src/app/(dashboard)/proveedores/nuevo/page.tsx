import { ProveedorForm } from "@/views/proveedor-form"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function NuevoProveedorPage() {
  await requirePagePermission("proveedores", "crear", "/proveedores")
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Nuevo Proveedor</h1>
        <p className="text-muted-foreground">Registra un nuevo proveedor en el sistema</p>
      </div>
      
      <ProveedorForm />
    </div>
  )
}
