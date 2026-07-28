import { BCRYPT_ROUNDS } from "@/shared/validation/password-validation"
import bcrypt from "bcryptjs"
import { UsuarioRepository } from "@/repositories/usuario.repository"
import { RolRepository } from "@/repositories/rol.repository"
import { HttpError } from "@/lib/route/http-error"

export interface CreateUsuarioData {
  nombre: string
  email: string
  password: string
  rol_id: number
}

export interface UpdateUsuarioData {
  nombre?: string
  email?: string
  rol_id?: number
  estado?: "activo" | "inactivo"
}

// En la DB: 1=admin. El anti auto-lockout se apoya en este id.
const ROL_ADMIN_ID = 1

// Gestión de usuarios por administrador (I/O en UsuarioRepository). Reglas: unicidad de email,
// hasheo de clave y baja lógica (estado = inactivo, que el login filtra).
export class UsuarioService {
  // Listado para la administración de usuarios: mapea la fila + join de rol al shape de la UI.
  static async getAll() {
    const rows = await UsuarioRepository.findAllConRoles()
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre || "",
      apellido: "", // no existe en gu_usuario; la UI lo espera
      rol: (u.gu_roles as { nombre?: string } | null)?.nombre?.toLowerCase() || "usuario",
      rol_id: u.rol_id,
      estado: u.estado ?? "activo",
      created_at: u.created_at,
      last_sign_in_at: null, // no se registra en gu_usuario
    }))
  }

  static async create(data: CreateUsuarioData) {
    if (await UsuarioRepository.findByEmail(data.email)) {
      throw new HttpError(409, "El email ya está registrado")
    }

    const password_hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS)

    return UsuarioRepository.insert({
      nombre: data.nombre,
      email: data.email,
      password_hash,
      rol_id: data.rol_id,
      estado: "activo",
    })
  }

  // `actor` es el admin logueado. Guarda anti auto-lockout: no puede desactivarse ni quitarse
  // el rol admin a sí mismo.
  static async update(id: number, data: UpdateUsuarioData, actor?: { id: number }) {
    if (
      actor &&
      actor.id === id &&
      (data.estado === "inactivo" || (data.rol_id !== undefined && data.rol_id !== ROL_ADMIN_ID))
    ) {
      throw new HttpError(400, "No podés desactivarte ni quitarte el rol de administrador a vos mismo")
    }
    // cast al borde de persistencia (el repo trabaja con columnas sueltas, sin tipar)
    return UsuarioRepository.update(id, { ...data } as Record<string, unknown>)
  }

  // Baja lógica (estado = inactivo; el login la excluye). Un admin no puede darse de baja a sí mismo.
  static async baja(id: number, actor: { id: number }) {
    if (actor.id === id) {
      throw new HttpError(400, "No podés darte de baja a vos mismo")
    }
    return UsuarioRepository.update(id, { estado: "inactivo" })
  }

  // Cambio de rol por admin. Guarda anti auto-lockout: un admin no puede quitarse a sí mismo
  // el rol admin.
  static async updateRol(id: number, nuevoRol: string, actor: { id: number }) {
    // No se whitelistea: cualquier rol que exista en gu_roles (incluidos los custom) es asignable.
    // La existencia la valida RolRepository.findByNombre abajo (404 si no existe).
    const actual = await UsuarioRepository.findById(id)
    if (!actual) {
      throw new HttpError(404, "Usuario no encontrado")
    }

    const rolActual = (actual.gu_roles as { nombre?: string } | null)?.nombre?.toLowerCase()
    if (actual.id === actor.id && rolActual === "admin" && nuevoRol !== "admin") {
      throw new HttpError(400, "No puedes quitarte a ti mismo el rol de administrador")
    }

    const rolNuevo = await RolRepository.findByNombre(nuevoRol)
    if (!rolNuevo) {
      throw new HttpError(404, "Rol no encontrado")
    }

    await UsuarioRepository.update(id, { rol_id: rolNuevo.id })
    return { id: actual.id, email: actual.email, rol: nuevoRol }
  }

  // Reset administrativo: pisa la clave sin pedir la anterior (distinto de changePassword)
  static async resetPassword(id: number, newPassword: string) {
    const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await UsuarioRepository.updatePassword(id, password_hash)
    return true
  }
}
