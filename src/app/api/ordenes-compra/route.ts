import { leerListado, cuerpoPaginado } from "@/lib/route/paginacion"
import { NextRequest, NextResponse } from "next/server"
import { OrdenCompraService } from "@/services"
import { CreateOrdenCompraSchema } from "@/shared/validation/orden-compra-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"
import { CACHE_NUNCA, headersCache } from "@/lib/route/cache"

// Columnas por las que se puede ordenar (?orden=campo.desc). Whitelist: sin ella el
// parametro serviria para ordenar por cualquier columna de la tabla.
const COLUMNAS_ORDEN = ["numero_oc", "fecha_oc", "total_con_iva", "estado", "created_at"] as const

// GET /api/ordenes-compra - Lista con el rollup de certificación (leído de v_oc_rollup).
// Gateado por permiso: 'ordenes_compra:ver' (los 4 roles del sistema lo tienen por el seed).
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requirePermission("ordenes_compra", "ver")
    if (authError) return authError

    const { paginacion, filtros, orden } = leerListado(request.url, {
      columnasOrden: COLUMNAS_ORDEN,
      ordenPorDefecto: { columna: "created_at", ascending: false },
    })

    const pagina = await OrdenCompraService.getPagina(paginacion, { filtros, orden })
    return NextResponse.json(cuerpoPaginado(request.url, pagina, paginacion), { headers: headersCache(CACHE_NUNCA) })
  } catch (error) {
    return handleRouteError(error, "GET /api/ordenes-compra")
  }
}

// POST /api/ordenes-compra - Crear nueva orden (nace en borrador, la DB le pone el número)
export const POST = createRoute({
  autorizar: () => requirePermission("ordenes_compra", "crear"),
  schema: CreateOrdenCompraSchema,
  crear: (data, user) => OrdenCompraService.create(data, user.id),
  audit: { tabla: "gu_ordenesdecompra", detalle: (oc) => `Orden de compra ${oc.numero_oc} creada` },
  contexto: "POST /api/ordenes-compra",
})
