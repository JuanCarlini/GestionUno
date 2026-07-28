import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/permissions-server"
import { AuditService } from "@/lib/audit/audit.service"
import { handleRouteError } from "@/lib/route/handle-route-error"

// GET /api/admin/auditoria — consulta de auditoría (solo admin), con búsqueda combinada.
// ?fuente=bitacora (operaciones con usuario) | cambios (historial de valores).
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const sp = request.nextUrl.searchParams
    const resultado = await AuditService.consultar({
      fuente: sp.get("fuente") === "cambios" ? "cambios" : "bitacora",
      usuarioId: sp.get("usuarioId"),
      tabla: sp.get("tabla"),
      accion: sp.get("accion"),
      desde: sp.get("desde"),
      hasta: sp.get("hasta"),
    })

    return NextResponse.json(resultado)
  } catch (error) {
    return handleRouteError(error, "GET /api/admin/auditoria")
  }
}
