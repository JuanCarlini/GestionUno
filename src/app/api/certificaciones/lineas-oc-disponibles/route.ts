import { NextRequest, NextResponse } from "next/server"
import { CertificacionService } from "@/services/certificacion.service"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { HttpError } from "@/lib/route/http-error"

// GET /api/certificaciones/lineas-oc-disponibles?ordenCompraId=N
// Líneas de esa OC con su saldo certificable (certificadas / pendientes), leído de v_loc_rollup.
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requirePermission("certificaciones", "ver")
    if (authError) return authError

    const param = request.nextUrl.searchParams.get("ordenCompraId")
    if (!param) throw new HttpError(400, "Falta el parámetro ordenCompraId")

    const lineas = await CertificacionService.getLineasDisponibles(parseId(param))
    return NextResponse.json(lineas)
  } catch (error) {
    return handleRouteError(error, "GET /api/certificaciones/lineas-oc-disponibles")
  }
}
