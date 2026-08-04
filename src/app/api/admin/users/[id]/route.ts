import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/permissions-server"
import { UsuarioService } from "@/services/usuario.service"
import { AuditService } from "@/lib/audit/audit.service"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import type { IdParams } from "@/lib/route/params"

// Whitelist del body, como el resto de las rutas: campos sueltos a mano dejaban pasar
// un email sin formato o un estado fuera del enum hasta reventar en la DB.
const UpdateUsuarioSchema = z.object({
  nombre: z.string().min(1).optional(),
  email: z.string().email("Email inválido").optional(),
  rol_id: z.coerce.number().int().positive().optional(),
  estado: z.enum(["activo", "inactivo"]).optional(),
})

// PUT /api/admin/users/[id] - Editar usuario (nombre, email, rol, estado)
export async function PUT(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError, user } = await requireAdmin()
    if (authError) return authError

    const userId = parseId((await params).id)
    const data = UpdateUsuarioSchema.parse(await request.json())

    // El anti auto-lockout vive en UsuarioService.update (regla de negocio, testeable).
    const actualizado = await UsuarioService.update(userId, data, { id: user!.id })

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
export async function DELETE(request: NextRequest, { params }: IdParams) {
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
