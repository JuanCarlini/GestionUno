import { PasswordSchema } from "@/shared/validation/password-validation"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/permissions-server"
import { UsuarioService } from "@/services/usuario.service"
import { AuditService } from "@/lib/audit/audit.service"
import { handleRouteError } from "@/lib/route/handle-route-error"

// GET /api/admin/users - Listar todos los usuarios (solo admin)
export async function GET() {
  try {
    // requireAdmin en vez del requireAuth + isAdmin inline que había acá: el chequeo a mano
    // hacía `user.rol as UserRole` (cast crudo de un string) en vez de stringToUserRole.
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const users = await UsuarioService.getAll()
    return NextResponse.json(users)
  } catch (error) {
    return handleRouteError(error, "GET /api/admin/users")
  }
}

// POST /api/admin/users - Alta de usuario (solo admin; el registro público está deshabilitado)
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const { nombre, email, password, rol_id } = body

    if (!nombre || !email || !password || !rol_id) {
      return NextResponse.json(
        { error: "nombre, email, password y rol_id son requeridos" },
        { status: 400 }
      )
    }
    PasswordSchema.parse(password) // política única; handleRouteError → 400

    const nuevo = await UsuarioService.create({ nombre, email, password, rol_id: Number(rol_id) })

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_usuario",
      registroId: nuevo.id,
      accion: "crear",
      detalle: `Usuario ${email} creado por admin`,
    })

    return NextResponse.json(nuevo, { status: 201 })
  } catch (error) {
    return handleRouteError(error, "POST /api/admin/users")
  }
}
