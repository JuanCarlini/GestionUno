import { ProyectoForm } from "@/views/proyecto-form"
import { PageHeader } from "@/components/page-header"
import { requirePagePermission } from "@/lib/auth/permissions-server"

export default async function NuevoProyectoPage() {
  await requirePagePermission("proyectos", "crear", "/proyectos")

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo Proyecto" description="Registra un proyecto para imputar órdenes de compra" />

      <ProyectoForm />
    </div>
  )
}
