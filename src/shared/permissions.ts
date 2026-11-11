import { UserRole } from "@/models"

// El RBAC por permisos (modulo:accion) reemplazó a los grupos de rol. Acá solo quedan los
// helpers por ROL que siguen vivos: el gating de /admin, que no es un par modulo:accion del
// catálogo. Los botones de la UI ya no pasan por acá, usan puede() del auth-context
// (canAnularDocumento y canModificarProveedor trataban cualquier rol custom como "usuario").

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
