import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/permissions-server"
import { UsuarioService } from "@/services/usuario.service"
import { AuditService } from "@/lib/audit/audit.service"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"

interface Params {
  params: Promise<{ id: string }>
}

// PUT /api/admin/users/[id] - Editar usuario (nombre, email, rol, estado)
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { error: authError, user } = await requireAdmin()
    if (authError) return authError

    const userId = parseId((await params).id)
    const body = await request.json()

    // El anti auto-lockout vive en UsuarioService.update (regla de negocio, testeable).
    const actualizado = await UsuarioService.update(
      userId,
      {
        nombre: body.nombre,
        email: body.email,
        rol_id: body.rol_id !== undefined ? Number(body.rol_id) : undefined,
        estado: body.estado,
      },
      { id: user!.id }
    )

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_usuario",
      registroId: userId,
      accion: "actualizar",
      detalle: `Usuario #${userId} actualizado por admin`,
    })

    return NextResponse.json(actualizado)
  } catch (error) {
    return handleRouteError(error, "PUT /api/admin/users/[id]")
  }
}

// DELETE /api/admin/users/[id] - Baja lógica (estado = inactivo; el login la excluye)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { error: authError, user } = await requireAdmin()
    if (authError) return authError

    const userId = parseId((await params).id)

    // El anti auto-baja vive en UsuarioService.baja (regla de negocio, testeable).
    await UsuarioService.baja(userId, { id: user!.id })

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_usuario",
      registroId: userId,
      accion: "eliminar",
      detalle: `Usuario #${userId} dado de baja (lógica) por admin`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/admin/users/[id]")
  }
}
