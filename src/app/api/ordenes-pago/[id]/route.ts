import { NextRequest, NextResponse } from "next/server"
import { OrdenPagoService } from "@/services"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { getByIdRoute } from "@/lib/route/crud-route"
import { AuditService } from "@/lib/audit/audit.service"
import type { IdParams } from "@/lib/route/params"

// GET /api/ordenes-pago/[id] - Cabecera + facturas + cajas
export const GET = getByIdRoute({
  autorizar: () => requirePermission("ordenes_pago", "ver"),
  getById: (id) => OrdenPagoService.getById(id),
  noEncontrado: "Orden de pago no encontrada",
  contexto: "GET /api/ordenes-pago/[id]",
})

// DELETE /api/ordenes-pago/[id]
export async function DELETE(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError, user } = await requirePermission("ordenes_pago", "borrar")
    if (authError) return authError

    const id = parseId((await params).id)

    const success = await OrdenPagoService.delete(id)
    if (!success) {
      return NextResponse.json({ error: "Orden de pago no encontrada" }, { status: 404 })
    }

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_ordenesdepago",
      registroId: id,
      accion: "eliminar",
      detalle: `Orden de pago #${id} eliminada`,
    })

    return NextResponse.json({ message: "Orden de pago eliminada correctamente" })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/ordenes-pago/[id]")
  }
}
