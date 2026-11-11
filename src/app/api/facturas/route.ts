import { leerListado, cuerpoPaginado } from "@/lib/route/paginacion"
import { NextRequest, NextResponse } from "next/server"
import { FacturaService } from "@/services/factura.service"
import { CreateFacturaSchema } from "@/shared/validation/factura-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"
import { CACHE_NUNCA, headersCache } from "@/lib/route/cache"

// Columnas por las que se puede ordenar (?orden=campo.desc). Whitelist: sin ella el
// parametro serviria para ordenar por cualquier columna de la tabla.
const COLUMNAS_ORDEN = ["numero_factura", "fecha_emision", "total_con_iva", "estado", "created_at"] as const

// GET /api/facturas - Lista con el rollup de pago (v_factura_rollup)
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requirePermission("facturas", "ver")
    if (authError) return authError
    const { paginacion, filtros, orden } = leerListado(request.url, {
      columnasOrden: COLUMNAS_ORDEN,
      ordenPorDefecto: { columna: "created_at", ascending: false },
    })

    const pagina = await FacturaService.getPagina(paginacion, { filtros, orden })
    return NextResponse.json(cuerpoPaginado(request.url, pagina, paginacion), { headers: headersCache(CACHE_NUNCA) })
  } catch (error) {
    return handleRouteError(error, "GET /api/facturas")
  }
}

// POST /api/facturas - Crear factura (líneas + imputaciones a certs aprobadas).
// 422 si una imputación viola fn_check_imputacion (cert no aprobada o Σ > total de líneas).
export const POST = createRoute({
  autorizar: () => requirePermission("facturas", "crear"),
  schema: CreateFacturaSchema,
  crear: (data) => FacturaService.create(data),
  audit: {
    tabla: "gu_facturas",
    detalle: (f) => `Factura ${f.numero_factura ?? f.id} creada`,
  },
  contexto: "POST /api/facturas",
})
