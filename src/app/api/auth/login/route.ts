import { NextRequest, NextResponse } from "next/server"
import { AuthService } from '@/lib/auth/auth.service'
import { setAuthCookie } from '@/lib/auth/auth.cookies'
import { AuditService } from '@/lib/audit/audit.service'
import { estaBloqueado, registrarFallo, limpiarIntentos, resolverIp, clavesDeLogin } from '@/lib/auth/rate-limit'
import { handleRouteError } from '@/lib/route/handle-route-error'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body
    
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Formato de email inválido" },
        { status: 400 }
      )
    }

    // Rate-limiting contra fuerza bruta. El contador por email (no depende de headers)
    // es el que de verdad frena el ataque; el de ip+email es best-effort (la IP se rota).
    const now = Date.now()
    const ip = resolverIp(request.headers)
    const { porEmail, porIpEmail } = clavesDeLogin(ip, email)

    const rl = estaBloqueado(porEmail, now).bloqueado
      ? estaBloqueado(porEmail, now)
      : estaBloqueado(porIpEmail, now)
    if (rl.bloqueado) {
      return NextResponse.json(
        { error: "Demasiados intentos fallidos. Probá de nuevo más tarde." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      )
    }

    const result = await AuthService.login(email, password)

    if (!result) {
      registrarFallo(porEmail, now)
      registrarFallo(porIpEmail, now)
      // Bitácora: el intento fallido queda registrado y es investigable.
      await AuditService.registrarLoginFallido(String(email), ip)
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      )
    }

    limpiarIntentos(porEmail)
    limpiarIntentos(porIpEmail)

    await setAuthCookie(result.token)

    // Bitácora: inicio de sesión
    await AuditService.registrar({
      usuarioId: result.user.id,
      tabla: 'sesion',
      registroId: result.user.id,
      accion: 'login',
      detalle: `Inicio de sesión: ${result.user.email}`,
    })

    // Retornar usuario (sin el token en el body por seguridad)
    return NextResponse.json({
      user: result.user,
      message: "Inicio de sesión exitoso"
    })
    
  } catch (error) {
    return handleRouteError(error, "POST /api/auth/login")
  }
}
