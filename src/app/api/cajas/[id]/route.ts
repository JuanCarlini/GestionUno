import { NextRequest, NextResponse } from "next/server"
import { CajaService } from "@/services"
import { UpdateCajaSchema } from "@/shared/validation/caja-validation"
import { requireAdmin } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { getByIdRoute } from "@/lib/route/crud-route"
import { AuditService } from "@/lib/audit/audit.service"
import type { IdParams } from "@/lib/route/params"

// GET /api/cajas/[id] — autentica el middleware
export const GET = getByIdRoute({
  getById: (id) => CajaService.getById(id),
  noEncontrado: "Caja no encontrada",
  contexto: "GET /api/cajas/[id]",
})

// PUT /api/cajas/[id] - Editar caja (solo admin). Cambiar la moneda devuelve 422.
export async function PUT(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError, user } = await requireAdmin()
    if (authError) return authError

    const id = parseId((await params).id)
    const validatedData = UpdateCajaSchema.parse(await request.json())

    const actualizada = await CajaService.update(id, validatedData)
    if (!actualizada) return NextResponse.json({ error: "Caja no encontrada" }, { status: 404 })

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_cajas",
      registroId: id,
      accion: "actualizar",
      detalle: `Caja ${actualizada.nombre} actualizada`,
    })

    return NextResponse.json(actualizada)
  } catch (error) {
    return handleRouteError(error, "PUT /api/cajas/[id]")
  }
}

// DELETE /api/cajas/[id] - Baja lógica (las líneas de OP apuntan a la caja)
export async function DELETE(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError, user } = await requireAdmin()
    if (authError) return authError

    const id = parseId((await params).id)
    await CajaService.delete(id)

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_cajas",
      registroId: id,
      accion: "eliminar",
      detalle: `Caja #${id} dada de baja`,
    })

    return NextResponse.json({ message: "Caja dada de baja correctamente" })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/cajas/[id]")
  }
}
