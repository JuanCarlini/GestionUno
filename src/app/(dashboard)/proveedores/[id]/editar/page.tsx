import { ProveedorEditarClient } from "@/views/proveedor-editar-client"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function EditarProveedorPage() {
  await requirePagePermission("proveedores", "crear", "/proveedores")
  return <ProveedorEditarClient />
}
