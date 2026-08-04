import { ProveedorForm } from "@/views/proveedor-form"
import { PageHeader } from "@/components/page-header"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function NuevoProveedorPage() {
  await requirePagePermission("proveedores", "crear", "/proveedores")
  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo Proveedor" description="Registra un nuevo proveedor en el sistema" />

      <ProveedorForm />
    </div>
  )
}
