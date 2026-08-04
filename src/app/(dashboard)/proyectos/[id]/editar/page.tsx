import { notFound } from "next/navigation"
import { ProyectoForm } from "@/views/proyecto-form"
import { PageHeader } from "@/components/page-header"
import { ProyectoService } from "@/services/proyecto.service"
import { requirePagePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"

interface Params {
  params: Promise<{ id: string }>
}

export default async function EditarProyectoPage({ params }: Params) {
  await requirePagePermission("proyectos", "crear", "/proyectos")

  const proyecto = await ProyectoService.getById(parseId((await params).id))
  if (!proyecto) notFound()

  return (
    <div className="space-y-6">
      <PageHeader title="Editar Proyecto" description={proyecto.nombre} />

      <ProyectoForm proyecto={proyecto} />
    </div>
  )
}
