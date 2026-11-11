import { leerListado, cuerpoPaginado } from "@/lib/route/paginacion"
import { NextRequest, NextResponse } from "next/server"
import { ProveedorService } from "@/services"
import { requirePermission } from "@/lib/auth/permissions-server"
import { CreateProveedorSchema } from "@/shared/validation/proveedor-validation"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"

// Columnas por las que se puede ordenar (?orden=campo.desc). Whitelist: sin ella el
// parametro serviria para ordenar por cualquier columna de la tabla.
const COLUMNAS_ORDEN = ["nombre", "cuit", "estado", "created_at"] as const

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requirePermission("proveedores", "ver")
    if (authError) return authError
    const { paginacion, filtros, orden } = leerListado(request.url, {
      columnasOrden: COLUMNAS_ORDEN,
      ordenPorDefecto: { columna: "nombre", ascending: true },
    })

    const pagina = await ProveedorService.getPagina(paginacion, { filtros, orden })
    return NextResponse.json(cuerpoPaginado(request.url, pagina, paginacion))
  } catch (error) {
    return handleRouteError(error, "GET /api/proveedores")
  }
}

export const POST = createRoute({
  autorizar: () => requirePermission("proveedores", "crear"),
  schema: CreateProveedorSchema, // whitelist de campos
  crear: (data) => ProveedorService.create(data),
  audit: { tabla: "gu_proveedores", detalle: (p) => `Proveedor ${p.nombre} creado` },
  contexto: "POST /api/proveedores",
})
