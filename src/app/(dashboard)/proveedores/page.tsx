import { ProveedorList } from "@/views/proveedor-list"
import { CrearButton } from "@/components/crear-button"
import { PageHeader } from "@/components/page-header"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function ProveedoresPage() {
  await requirePagePermission("proveedores", "ver")
  return (
    <div className="space-y-6">
      <PageHeader title="Proveedores" description="Gestiona los proveedores de tu empresa">
        <CrearButton modulo="proveedores" href="/proveedores/nuevo" label="Nuevo Proveedor" />
      </PageHeader>

      <ProveedorList />
    </div>
  )
}
