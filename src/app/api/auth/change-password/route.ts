import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions-server"
import { setAuthCookie } from "@/lib/auth/auth.cookies"
import { AuthService } from "@/lib/auth/auth.service"
import { AuditService } from "@/lib/audit/audit.service"
import { estaBloqueado, registrarFallo, limpiarIntentos } from "@/lib/auth/rate-limit"
import { PasswordSchema } from "@/shared/validation/password-validation"
import { handleRouteError } from "@/lib/route/handle-route-error"

// POST /api/auth/change-password - El usuario autenticado cambia su propia clave
// (distinto del reset administrativo: acá se exige la clave actual)
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireAuth()
    if (authError) return authError

    const { oldPassword, newPassword } = await request.json()

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: "La contraseña actual y la nueva son requeridas" },
        { status: 400 }
      )
    }
    // Política única y compartida: antes era un `length < 6` inline.
    // handleRouteError traduce el ZodError a 400 con el detalle.
    PasswordSchema.parse(newPassword)

    // Rate-limit del cambio de clave: sin esto, con una sesión robada se podía forzar la
    // contraseña ACTUAL a ritmo ilimitado (el 400 de "incorrecta" es un oráculo perfecto).
    const now = Date.now()
    const rlKey = `chpw:${user!.id}`
    const rl = estaBloqueado(rlKey, now)
    if (rl.bloqueado) {
      return NextResponse.json(
        { error: "Demasiados intentos fallidos. Probá de nuevo más tarde." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      )
    }

    const ok = await AuthService.changePassword(user!.id, oldPassword, newPassword)

    if (!ok) {
      registrarFallo(rlKey, now)
      return NextResponse.json(
        { error: "La contraseña actual es incorrecta" },
        { status: 400 }
      )
    }
    limpiarIntentos(rlKey)

    // El cambio de clave invalida TODAS las sesiones previas; se emite una cookie fresca
    // para que sobreviva solo la sesión desde la que se hizo el cambio.
    const actualizado = await AuthService.getUserById(user!.id)
    if (actualizado) await setAuthCookie(AuthService.emitirToken(actualizado))

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_usuario",
      registroId: user!.id,
      accion: "actualizar",
      detalle: "Cambio de contraseña propio (las demás sesiones quedaron invalidadas)",
    })

    return NextResponse.json({ success: true, message: "Contraseña actualizada" })
  } catch (error) {
    return handleRouteError(error, "POST /api/auth/change-password")
  }
}
