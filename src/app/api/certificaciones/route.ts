import { leerListado, cuerpoPaginado } from "@/lib/route/paginacion"
import { NextRequest, NextResponse } from "next/server"
import { CertificacionService } from "@/services/certificacion.service"
import { CreateCertificacionSchema } from "@/shared/validation/certificacion-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"
import { CACHE_NUNCA, headersCache } from "@/lib/route/cache"

// Columnas por las que se puede ordenar (?orden=campo.desc). Whitelist: sin ella el
// parametro serviria para ordenar por cualquier columna de la tabla.
const COLUMNAS_ORDEN = ["numero_cert", "fecha_cert", "total_con_iva", "estado", "created_at"] as const

// GET /api/certificaciones - Lista con el rollup de facturación (v_cert_rollup)
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requirePermission("certificaciones", "ver")
    if (authError) return authError
    const { paginacion, filtros, orden } = leerListado(request.url, {
      columnasOrden: COLUMNAS_ORDEN,
      ordenPorDefecto: { columna: "created_at", ascending: false },
    })

    const pagina = await CertificacionService.getPagina(paginacion, { filtros, orden })
    return NextResponse.json(cuerpoPaginado(request.url, pagina, paginacion), { headers: headersCache(CACHE_NUNCA) })
  } catch (error) {
    return handleRouteError(error, "GET /api/certificaciones")
  }
}

// POST /api/certificaciones - Certificar contra UNA orden de compra aprobada.
// 422 si la OC no está aprobada o si el trigger del 100% rechaza el avance.
export const POST = createRoute({
  autorizar: () => requirePermission("certificaciones", "crear"),
  schema: CreateCertificacionSchema,
  crear: (data) => CertificacionService.create(data),
  audit: { tabla: "gu_certificaciones", detalle: (c) => `Certificación ${c.numero_cert} creada` },
  contexto: "POST /api/certificaciones",
})
