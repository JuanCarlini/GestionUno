import { leerListado, cuerpoPaginado } from "@/lib/route/paginacion"
import { NextRequest, NextResponse } from "next/server"
import { ProyectoService } from "@/services/proyecto.service"
import { CreateProyectoSchema } from "@/shared/validation/proyecto-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"
import { CACHE_CATALOGO, headersCache } from "@/lib/route/cache"

// Columnas por las que se puede ordenar (?orden=campo.desc). Whitelist: sin ella el
// parametro serviria para ordenar por cualquier columna de la tabla.
const COLUMNAS_ORDEN = ["nombre", "codigo", "estado", "fecha_inicio", "created_at"] as const

// GET /api/proyectos - Listar proyectos, autorizado contra la matriz como el resto del circuito.
export async function GET(request: NextRequest) {
  try {
    const { error } = await requirePermission("proyectos", "ver")
    if (error) return error

    const { paginacion, filtros, orden } = leerListado(request.url, {
      columnasOrden: COLUMNAS_ORDEN,
      ordenPorDefecto: { columna: "created_at", ascending: false },
    })

    const pagina = await ProyectoService.getPagina(paginacion, { filtros, orden })
    return NextResponse.json(cuerpoPaginado(request.url, pagina, paginacion), { headers: headersCache(CACHE_CATALOGO) })
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
