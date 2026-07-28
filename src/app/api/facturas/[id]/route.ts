import { NextRequest, NextResponse } from "next/server"
import { FacturaService } from "@/services/factura.service"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { getByIdRoute } from "@/lib/route/crud-route"
import { AuditService } from "@/lib/audit/audit.service"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/facturas/[id] - Cabecera + líneas + imputaciones + rollup de pago
export const GET = getByIdRoute({
  autorizar: () => requirePermission("facturas", "ver"),
  getById: (id) => FacturaService.getById(id),
  noEncontrado: "Factura no encontrada",
  contexto: "GET /api/facturas/[id]",
})

// DELETE /api/facturas/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("facturas", "borrar")
    if (authError) return authError

    const id = parseId((await params).id)

    const success = await FacturaService.delete(id)
    if (!success) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    }

    await AuditService.registrarDesdeRequest({
      tabla: "gu_facturas",
      registroId: id,
      accion: "eliminar",
      detalle: `Factura #${id} eliminada`,
    })

    return NextResponse.json({ message: "Factura eliminada correctamente" })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/facturas/[id]")
  }
}
