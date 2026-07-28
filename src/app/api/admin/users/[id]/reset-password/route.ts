import { PasswordSchema } from "@/shared/validation/password-validation"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/permissions-server"
import { UsuarioService } from "@/services/usuario.service"
import { AuditService } from "@/lib/audit/audit.service"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/admin/users/[id]/reset-password - Reset administrativo de clave.
// Es también el "recuperar clave": sin servicio de email, el admin asigna una clave nueva.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { error: authError, user } = await requireAdmin()
    if (authError) return authError

    const userId = parseId((await params).id)
    const { password } = await request.json()

    PasswordSchema.parse(password) // política única; handleRouteError → 400

    await UsuarioService.resetPassword(userId, password)

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_usuario",
      registroId: userId,
      accion: "resetear",
      detalle: `Clave del usuario #${userId} reseteada por admin`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, "POST /api/admin/users/[id]/reset-password")
  }
}
