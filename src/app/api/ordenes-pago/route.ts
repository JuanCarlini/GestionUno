import { leerListado, cuerpoPaginado } from "@/lib/route/paginacion"
import { NextRequest, NextResponse } from "next/server"
import { OrdenPagoService } from "@/services"
import { CreateOrdenPagoSchema } from "@/shared/validation/orden-pago-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"
import { CACHE_NUNCA, headersCache } from "@/lib/route/cache"

// Columnas por las que se puede ordenar (?orden=campo.desc). Whitelist: sin ella el
// parametro serviria para ordenar por cualquier columna de la tabla.
const COLUMNAS_ORDEN = ["numero_op", "fecha_op", "total_a_pagar", "estado", "created_at"] as const

// GET /api/ordenes-pago - Lista (con el nombre del proveedor aplanado)
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requirePermission("ordenes_pago", "ver")
    if (authError) return authError
    const { paginacion, filtros, orden } = leerListado(request.url, {
      columnasOrden: COLUMNAS_ORDEN,
      ordenPorDefecto: { columna: "created_at", ascending: false },
    })

    const pagina = await OrdenPagoService.getPagina(paginacion, { filtros, orden })
    return NextResponse.json(cuerpoPaginado(request.url, pagina, paginacion), { headers: headersCache(CACHE_NUNCA) })
  } catch (error) {
    return handleRouteError(error, "GET /api/ordenes-pago")
  }
}

// POST /api/ordenes-pago - Crear la OP (vacía: nace en borrador con total 0).
// Las facturas y las cajas se cargan con /[id]/facturas y /[id]/cajas.
export const POST = createRoute({
  autorizar: () => requirePermission("ordenes_pago", "crear"),
  schema: CreateOrdenPagoSchema,
  crear: (data) => OrdenPagoService.create(data),
  audit: {
    tabla: "gu_ordenesdepago",
    detalle: (o) => `Orden de pago ${o.numero_op ?? o.id} creada`,
  },
  contexto: "POST /api/ordenes-pago",
})
