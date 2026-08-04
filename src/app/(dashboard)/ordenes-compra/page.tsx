import { OrdenCompraList } from "@/views/orden-compra-list"
import { CrearButton } from "@/components/crear-button"
import { PageHeader } from "@/components/page-header"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function OrdenesCompraPage() {
  await requirePagePermission("ordenes_compra", "ver")
  return (
    <div className="space-y-6">
      <PageHeader title="Órdenes de Compra" description="Gestiona las órdenes de compra">
        <CrearButton modulo="ordenes_compra" href="/ordenes-compra/nueva" label="Nueva Orden" />
      </PageHeader>
      <OrdenCompraList />
    </div>
  )
}
