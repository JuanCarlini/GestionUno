import { ProyectoList } from "@/views/proyecto-list"
import { CrearButton } from "@/components/crear-button"
import { PageHeader } from "@/components/page-header"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function ProyectosPage() {
  await requirePagePermission("proyectos", "ver")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyectos"
        description="Obras y centros de costo a los que se imputan las órdenes de compra"
      >
        <CrearButton modulo="proyectos" href="/proyectos/nuevo" label="Nuevo Proyecto" />
      </PageHeader>

      <ProyectoList />
    </div>
  )
}
