import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { UsuarioService } from "@/services/usuario.service"
import { AuditService } from "@/lib/audit/audit.service"

// PATCH /api/admin/users/[id]/role - Actualizar rol de un usuario (solo admin).
// El I/O vive en UsuarioService; la ruta solo autoriza, parsea y audita.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireAdmin()
    if (authError) return authError

    const id = parseId((await params).id)
    const { rol } = await request.json()

    const actualizado = await UsuarioService.updateRol(id, rol, { id: user!.id })

    // El cambio de rol es una acción sensible: queda en la bitácora.
    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_usuario",
      registroId: id,
      accion: "actualizar",
      detalle: `Cambio de rol a '${rol}'`,
    })

    return NextResponse.json({
      success: true,
      message: "Rol actualizado correctamente",
      user: actualizado,
    })
  } catch (error) {
    return handleRouteError(error, "PATCH /api/admin/users/[id]/role")
  }
}
