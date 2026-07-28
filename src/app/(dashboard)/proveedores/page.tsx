import { ProveedorList } from "@/views/proveedor-list"
import { CrearButton } from "@/components/crear-button"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function ProveedoresPage() {
  await requirePagePermission("proveedores", "ver")
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Proveedores</h1>
          <p className="text-muted-foreground">Gestiona los proveedores de tu empresa</p>
        </div>
        <CrearButton modulo="proveedores" href="/proveedores/nuevo" label="Nuevo Proveedor" />
      </div>
      
      <ProveedorList />
    </div>
  )
}
