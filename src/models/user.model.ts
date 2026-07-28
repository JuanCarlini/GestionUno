// Roles del sistema. En la DB: 1=admin, 2=usuario, 3=supervisor, 4=readonly (minúsculas).
// Los 4 están protegidos contra rename/delete en RolService.
export enum UserRole {
  ADMIN = "admin",
  USUARIO = "usuario",
  SUPERVISOR = "supervisor",
  READONLY = "readonly"
}

// El usuario que ve la UI (lo devuelve GET /api/auth/me). El del server, con rol_id y
// estado, vive en lib/auth/auth.service.ts. `id` es number: PK BIGINT de punta a punta.
export interface AuthUser {
  id: number
  email: string
  nombre: string
  rol: UserRole
  // Permisos `modulo:accion` del rol (para gatear botones en el cliente). admin = [] (pasa
  // por short-circuit en tienePermiso). Los custom traen su matriz.
  permisos: string[]
}
