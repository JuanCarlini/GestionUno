import { NextRequest, NextResponse } from "next/server"
import { ProyectoService } from "@/services/proyecto.service"
import { UpdateProyectoSchema } from "@/shared/validation/proyecto-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { getByIdRoute } from "@/lib/route/crud-route"
import type { IdParams } from "@/lib/route/params"
import { respuestaError } from "@/lib/route/respuesta-error"
import { CACHE_CATALOGO } from "@/lib/route/cache"

export const GET = getByIdRoute({
  autorizar: () => requirePermission("proyectos", "ver"),
  getById: (id) => ProyectoService.getById(id),
  noEncontrado: "Proyecto no encontrado",
  contexto: "GET /api/proyectos/[id]",
  cache: CACHE_CATALOGO,
})

export async function PUT(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError } = await requirePermission("proyectos", "crear")
    if (authError) return authError

    const id = parseId((await params).id)
    const data = UpdateProyectoSchema.parse(await request.json())
    const proyecto = await ProyectoService.update(id, data)

    if (!proyecto) {
      return respuestaError(404, "Proyecto no encontrado")
    }

    return NextResponse.json(proyecto)
  } catch (error) {
    return handleRouteError(error, "PUT /api/proyectos/[id]")
  }
}
