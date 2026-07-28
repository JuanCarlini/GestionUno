import { UserRole } from "@/models"

// El RBAC por permisos (modulo:accion) reemplazó a los grupos de rol; acá solo quedan los
// helpers por ROL que siguen vivos (secciones /admin/* y gating de botones en la UI).

// Solo supervisores y administradores pueden anular documentos.
export function canAnularDocumento(userRole: UserRole): boolean {
  return userRole === UserRole.ADMIN || userRole === UserRole.SUPERVISOR
}

// Solo supervisores y administradores pueden suspender o activar proveedores.
export function canModificarProveedor(userRole: UserRole): boolean {
  return userRole === UserRole.ADMIN || userRole === UserRole.SUPERVISOR
}

export function isAdmin(userRole: UserRole): boolean {
  return userRole === UserRole.ADMIN
}

export function stringToUserRole(rol: string): UserRole {
  const roleLower = rol.toLowerCase()
  switch (roleLower) {
    case "admin":
      return UserRole.ADMIN
    case "supervisor":
      return UserRole.SUPERVISOR
    case "readonly":
      return UserRole.READONLY
    case "usuario":
    default:
      return UserRole.USUARIO
  }
}

// Chequeo PURO de permisos, sin DB: 'admin' pasa siempre (anti auto-lockout), el resto por
// membership en su array `modulo:accion`. Aislado del I/O para poder testearlo sin Supabase.
export function tienePermiso(
  rolNombre: string,
  permisos: string[],
  modulo: string,
  accion: string
): boolean {
  if (rolNombre.toLowerCase() === "admin") return true
  return permisos.includes(`${modulo}:${accion}`)
}
