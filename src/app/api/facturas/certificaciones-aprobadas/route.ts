import { NextRequest, NextResponse } from "next/server"
import { FacturaService } from "@/services/factura.service"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { HttpError } from "@/lib/route/http-error"

// GET /api/facturas/certificaciones-aprobadas?proveedorId=N
// Certificaciones aprobadas del proveedor, para elegir a cuáles imputar la factura.
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requirePermission("facturas", "ver")
    if (authError) return authError

    const param = request.nextUrl.searchParams.get("proveedorId")
    if (!param) throw new HttpError(400, "Falta el parámetro proveedorId")

    const certificaciones = await FacturaService.getCertificacionesAprobadas(parseId(param))
    return NextResponse.json(certificaciones)
  } catch (error) {
    return handleRouteError(error, "GET /api/facturas/certificaciones-aprobadas")
  }
}
