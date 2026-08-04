import { NextRequest, NextResponse } from "next/server"
import { CertificacionService } from "@/services/certificacion.service"
import { UpdateCertificacionSchema } from "@/shared/validation/certificacion-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { getByIdRoute } from "@/lib/route/crud-route"
import { AuditService } from "@/lib/audit/audit.service"
import type { IdParams } from "@/lib/route/params"

// GET /api/certificaciones/[id] - Cabecera + líneas derivadas + rollup de facturación
export const GET = getByIdRoute({
  autorizar: () => requirePermission("certificaciones", "ver"),
  getById: (id) => CertificacionService.getById(id),
  noEncontrado: "Certificación no encontrada",
  contexto: "GET /api/certificaciones/[id]",
})

// PUT /api/certificaciones/[id] - Editar la cabecera (el estado va por PATCH /estado)
export async function PUT(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError, user } = await requirePermission("certificaciones", "crear")
    if (authError) return authError

    const id = parseId((await params).id)
    const validatedData = UpdateCertificacionSchema.parse(await request.json())

    const cert = await CertificacionService.update(id, validatedData)
    if (!cert) {
      return NextResponse.json({ error: "Certificación no encontrada" }, { status: 404 })
    }

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_certificaciones",
      registroId: id,
      accion: "actualizar",
      detalle: `Certificación ${cert.numero_cert ?? id}: actualizar`,
    })

    return NextResponse.json(cert)
  } catch (error) {
    return handleRouteError(error, "PUT /api/certificaciones/[id]")
  }
}

// DELETE /api/certificaciones/[id]
export async function DELETE(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError, user } = await requirePermission("certificaciones", "borrar")
    if (authError) return authError

    const id = parseId((await params).id)

    const success = await CertificacionService.delete(id)
    if (!success) {
      return NextResponse.json({ error: "Certificación no encontrada" }, { status: 404 })
    }

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_certificaciones",
      registroId: id,
      accion: "eliminar",
      detalle: `Certificación #${id} eliminada`,
    })

    return NextResponse.json({ message: "Certificación eliminada correctamente" })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/certificaciones/[id]")
  }
}
