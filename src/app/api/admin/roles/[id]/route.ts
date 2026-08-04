import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/permissions-server"
import { RolService } from "@/services/rol.service"
import { AuditService } from "@/lib/audit/audit.service"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import type { IdParams } from "@/lib/route/params"

// PUT /api/admin/roles/[id] - Editar rol (los del sistema no se renombran)
export async function PUT(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError, user } = await requireAdmin()
    if (authError) return authError

    const id = parseId((await params).id)
    const body = await request.json()

    const actualizado = await RolService.update(id, {
      nombre: body.nombre,
      descripcion: body.descripcion,
      permisos: body.permisos,
    })

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_roles",
      registroId: id,
      accion: "actualizar",
      detalle: `Rol #${id} actualizado`,
    })

    return NextResponse.json(actualizado)
  } catch (error) {
    return handleRouteError(error, "PUT /api/admin/roles/[id]")
  }
}

// DELETE /api/admin/roles/[id] - Eliminar rol (bloqueado si es del sistema o tiene usuarios)
export async function DELETE(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError, user } = await requireAdmin()
    if (authError) return authError

    const id = parseId((await params).id)
    await RolService.delete(id)

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_roles",
      registroId: id,
      accion: "eliminar",
      detalle: `Rol #${id} eliminado`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/admin/roles/[id]")
  }
}
