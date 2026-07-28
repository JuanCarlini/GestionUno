import { NextResponse } from "next/server"
import { ProyectoService } from "@/services/proyecto.service"
import { CreateProyectoSchema } from "@/shared/validation/proyecto-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"

// GET /api/proyectos - Listar proyectos, autorizado contra la matriz como el resto del circuito.
export async function GET() {
  try {
    const { error } = await requirePermission("proyectos", "ver")
    if (error) return error

    const proyectos = await ProyectoService.getAll()
    return NextResponse.json(proyectos)
  } catch (error) {
    return handleRouteError(error, "GET /api/proyectos")
  }
}

// POST /api/proyectos - Crear proyecto. Zod whitelistea el body y el estado lo pone la DB,
// no el cliente (anti mass-assignment); el gate autoriza contra la matriz de permisos.
export const POST = createRoute({
  autorizar: () => requirePermission("proyectos", "crear"),
  schema: CreateProyectoSchema,
  crear: (data) => ProyectoService.create(data),
  contexto: "POST /api/proyectos",
})
