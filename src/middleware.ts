import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { getJwtSecret } from '@/lib/auth/jwt-secret'

// Registro público deshabilitado: los usuarios los da de alta el admin.
const publicRoutes = ['/login', '/api/auth/login']
const authRoutes = ['/login']

async function verificarToken(token: string): Promise<boolean> {
  // Se lee en cada request (no a nivel de módulo: eso rompe el build de Next).
  // Misma validación de fuerza que usa AuthService al firmar: un secreto ausente O débil
  // se trata igual. Fail-CLOSED: el token se considera inválido (el usuario cae a /login
  // o recibe 401), nunca se deja pasar.
  let secret: string
  try {
    secret = getJwtSecret()
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'JWT_SECRET inválida')
    return false
  }
  try {
    // Verificación real de firma (HS256, mismo secreto que AuthService.login)
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  const isApiRoute = pathname.startsWith('/api')

  const token = request.cookies.get('auth_token')?.value
  const tokenValido = token ? await verificarToken(token) : false

  // Sin token válido y ruta protegida: 401 para API, redirect a login para páginas
  if (!tokenValido && !isPublicRoute) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    if (token) {
      // cookie presente pero inválida/expirada/falsificada: limpiarla
      response.cookies.delete('auth_token')
    }
    return response
  }

  // Usuario autenticado intentando ir a login: mandarlo al dashboard
  if (tokenValido && authRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
