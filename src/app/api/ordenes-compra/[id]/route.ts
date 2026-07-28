import { NextRequest, NextResponse } from "next/server"
import { OrdenCompraService } from "@/services"
import { UpdateOrdenCompraSchema } from "@/shared/validation/orden-compra-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { getByIdRoute } from "@/lib/route/crud-route"
import { AuditService } from "@/lib/audit/audit.service"

// GET /api/ordenes-compra/[id] - Obtener una orden específica
export const GET = getByIdRoute({
  autorizar: () => requirePermission("ordenes_compra", "ver"),
  getById: (id) => OrdenCompraService.getById(id),
  noEncontrado: "Orden de compra no encontrada",
  contexto: "GET /api/ordenes-compra/[id]",
})

// PUT /api/ordenes-compra/[id] - Editar la cabecera (el estado va por PATCH /estado)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requirePermission("ordenes_compra", "crear")
    if (authError) return authError

    const id = parseId((await params).id)
    const validatedData = UpdateOrdenCompraSchema.parse(await request.json())

    const ordenActualizada = await OrdenCompraService.update(id, validatedData)
    if (!ordenActualizada) {
      return NextResponse.json({ error: "Orden de compra no encontrada" }, { status: 404 })
    }

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_ordenesdecompra",
      registroId: id,
      accion: "actualizar",
      detalle: `Orden de compra ${ordenActualizada.numero_oc ?? id}: actualizar`,
    })

    return NextResponse.json(ordenActualizada)
  } catch (error) {
    return handleRouteError(error, "PUT /api/ordenes-compra/[id]")
  }
}

// DELETE /api/ordenes-compra/[id] - Eliminar una orden
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requirePermission("ordenes_compra", "borrar")
    if (authError) return authError

    const id = parseId((await params).id)

    const eliminada = await OrdenCompraService.delete(id)
    if (!eliminada) {
      return NextResponse.json({ error: "Orden de compra no encontrada" }, { status: 404 })
    }

    await AuditService.registrarDesdeRequest({
      tabla: "gu_ordenesdecompra",
      registroId: id,
      accion: "eliminar",
      detalle: `Orden de compra #${id} eliminada`,
    })

    return NextResponse.json({ message: "Orden eliminada correctamente" })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/ordenes-compra/[id]")
  }
}
