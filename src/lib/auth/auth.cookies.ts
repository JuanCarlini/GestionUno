import { cookies } from 'next/headers'
import { AuthService } from './auth.service'
import { tokenQuedoObsoleto } from './session-freshness'

const COOKIE_NAME = 'auth_token'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 días en segundos

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  })
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value
}

export async function removeAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getCurrentUser() {
  try {
    const token = await getAuthCookie()
    
    if (!token) {
      return null
    }

    const payload = await AuthService.verifyToken(token)
    
    if (!payload) {
      await removeAuthCookie()
      return null
    }

    const user = await AuthService.getUserById(payload.userId)

    if (!user) {
      await removeAuthCookie()
      return null
    }

    // Si la credencial cambió después de emitirse este token, la sesión murió.
    // Es lo que hace que "cambiale la contraseña" expulse de verdad a un atacante.
    if (tokenQuedoObsoleto(payload.iat, user.updated_at)) {
      await removeAuthCookie()
      return null
    }

    return user
  } catch (error) {
    console.error('Error al obtener usuario actual:', error)
    return null
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}
