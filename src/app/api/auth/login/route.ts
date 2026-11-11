import { NextRequest, NextResponse } from "next/server"
import { AuthService } from '@/lib/auth/auth.service'
import { setAuthCookie } from '@/lib/auth/auth.cookies'
import { AuditService } from '@/lib/audit/audit.service'
import { estaBloqueado, registrarFallo, limpiarIntentos, resolverIp, clavesDeLogin } from '@/lib/auth/rate-limit'
import { handleRouteError } from '@/lib/route/handle-route-error'
import { respuestaError } from "@/lib/route/respuesta-error"

export async function POST(request: NextRequest) {
  try {
    // Un body no-JSON o no-objeto cae al 400 de abajo, no a un 500 por destructuring.
    const body = await request.json().catch(() => null)
    const { email, password } = body ?? {}


    if (!email || !password) {
      return respuestaError(400, "Email y contraseña son requeridos")
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return respuestaError(400, "Formato de email inválido")
    }

    // Rate-limiting contra fuerza bruta. El contador por email (no depende de headers)
    // es el que de verdad frena el ataque; el de ip+email es best-effort (la IP se rota).
    const now = Date.now()
    const ip = resolverIp(request.headers)
    const { porEmail, porIpEmail } = clavesDeLogin(ip, email)

    const porCuenta = await estaBloqueado(porEmail, now)
    const rl = porCuenta.bloqueado ? porCuenta : await estaBloqueado(porIpEmail, now)
    if (rl.bloqueado) {
      return respuestaError(429, "Demasiados intentos fallidos. Probá de nuevo más tarde.", { headers: { "Retry-After": String(rl.retryAfterSec) } })
    }

    const result = await AuthService.login(email, password)

    if (!result) {
      await registrarFallo(porEmail, now)
      await registrarFallo(porIpEmail, now)
      // Bitácora: el intento fallido queda registrado y es investigable.
      await AuditService.registrarLoginFallido(String(email), ip)
      return respuestaError(401, "Credenciales inválidas")
    }

    await limpiarIntentos(porEmail)
    await limpiarIntentos(porIpEmail)

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
