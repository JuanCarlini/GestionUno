import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/auth.cookies"
import { isAdmin, stringToUserRole, tienePermiso } from "@/shared/permissions"
import { RolRepository } from "@/repositories/rol.repository"

// Usuario autenticado desde el servidor: base interna de los require* de este archivo.
async function getAuthenticatedUser() {
  const user = await getCurrentUser()

  if (!user) {
    return null
  }

  // id es number (PK BIGINT) de punta a punta: stringificarlo acá rompía en silencio
  // las comparaciones `usuario.id === user.id` de las rutas admin.
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol_nombre?.toLowerCase() || 'usuario'
  }
}

/**
 * Verifica autenticación: retorna el usuario o un NextResponse con error 401/403.
 * Solo para API Routes.
 */
export async function requireAuth() {
  const user = await getAuthenticatedUser()

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      ),
      user: null
    }
  }

  return { error: null, user }
}

/**
 * Como requireAuth, pero además exige rol admin (rutas /api/admin/*)
 */
export async function requireAdmin() {
  const { error, user } = await requireAuth()
  if (error) return { error, user: null }

  if (!isAdmin(stringToUserRole(user!.rol))) {
    return {
      error: NextResponse.json(
        { error: "No tienes permisos de administrador" },
        { status: 403 }
      ),
      user: null
    }
  }

  return { error: null, user }
}

/**
 * Autoriza por PERMISO del rol (`modulo:accion`), resuelto fresco por request (sin staleness
 * de JWT). Delega en `tienePermiso` (admin short-circuit + membership). Solo API Routes.
 */
export async function requirePermission(modulo: string, accion: string) {
  const { error, user } = await requireAuth()
  if (error) return { error, user: null }

  // admin igual pega la query y el short-circuit vive en tienePermiso (una sola fuente de
  // verdad). El lookup por nombre es inocuo; si algún día pesa, un isAdmin early-return lo evita.
  const permisos = await RolRepository.findPermisosByNombre(user!.rol)
  if (!tienePermiso(user!.rol, permisos, modulo, accion)) {
    return {
      error: NextResponse.json(
        { error: "No tenés permisos para realizar esta acción" },
        { status: 403 }
      ),
      user: null
    }
  }

  return { error: null, user }
}

/**
 * Guarda de PÁGINA (Server Components): sin usuario redirige a /login, sin permiso al fallback.
 * La autorización real vive en la API; esto solo bloquea el acceso por URL directa.
 */
export async function requirePagePermission(modulo: string, accion: string, fallbackUrl = "/dashboard") {
  const user = await getAuthenticatedUser()
  if (!user) redirect("/login")
  const permisos = await RolRepository.findPermisosByNombre(user.rol)
  if (!tienePermiso(user.rol, permisos, modulo, accion)) redirect(fallbackUrl)
  return { user }
}

/**
 * Guarda de PÁGINA por rol admin (Server Components): /admin/* es por rol, no RBAC. Bloquea
 * el acceso por URL directa, que un guard en useEffect no puede (esconde la UI tras hidratar).
 */
export async function requirePageAdmin(fallbackUrl = "/dashboard") {
  const user = await getAuthenticatedUser()
  if (!user) redirect("/login")
  if (!isAdmin(stringToUserRole(user.rol))) redirect(fallbackUrl)
  return { user }
}
