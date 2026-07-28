import { RolRepository } from "@/repositories/rol.repository"
import { esPermisoValido } from "@/shared/permissions-catalog"
import { HttpError } from "@/lib/route/http-error"

// Los 4 roles del sistema están protegidos contra rename/delete. Un rol nuevo arranca con los
// permisos que le asigne el admin desde la matriz.
const ROLES_SISTEMA = ["admin", "usuario", "supervisor", "readonly"]

// Cada clave de permisos[] debe existir en el catálogo — nunca confiar en el body.
function validarPermisos(permisos: string[]) {
  const invalida = permisos.find((p) => !esPermisoValido(p))
  if (invalida) throw new HttpError(400, `Permiso inválido: ${invalida}`)
}

// Reglas de negocio de roles. El I/O vive en RolRepository.
export class RolService {
  static async getAll() {
    const roles = await RolRepository.findAllOrdered()

    // cantidad de usuarios por rol (para bloquear borrado de roles en uso)
    const rolIds = await RolRepository.findAllUsuarioRolIds()
    const conteo = new Map<number, number>()
    for (const rolId of rolIds) {
      conteo.set(rolId, (conteo.get(rolId) || 0) + 1)
    }

    return roles.map((rol: any) => ({
      ...rol,
      usuarios: conteo.get(rol.id) || 0,
      es_sistema: ROLES_SISTEMA.includes(rol.nombre),
    }))
  }

  static async create(data: { nombre: string; descripcion?: string; permisos?: string[] }) {
    const nombre = data.nombre.trim().toLowerCase()

    if (await RolRepository.findByNombre(nombre)) {
      throw new HttpError(409, `Ya existe un rol llamado "${nombre}"`)
    }
    if (data.permisos) validarPermisos(data.permisos)

    return RolRepository.insert({ nombre, descripcion: data.descripcion ?? null, permisos: data.permisos ?? [] })
  }

  static async update(id: number, data: { nombre?: string; descripcion?: string; permisos?: string[] }) {
    const rol = await RolRepository.findById(id)
    if (!rol) throw new HttpError(404, "Rol no encontrado")

    // los roles del sistema no se renombran (el código depende del nombre)
    if (data.nombre && ROLES_SISTEMA.includes(rol.nombre) && data.nombre.trim().toLowerCase() !== rol.nombre) {
      throw new HttpError(409, `"${rol.nombre}" es un rol del sistema y no puede renombrarse`)
    }

    const payload: Record<string, unknown> = {}
    if (data.nombre) payload.nombre = data.nombre.trim().toLowerCase()
    if (data.descripcion !== undefined) payload.descripcion = data.descripcion
    // Anti auto-lockout: el rol admin es intocable — pasa siempre por el short-circuit de
    // tienePermiso, así que ignoramos cualquier `permisos` entrante para admin.
    if (data.permisos !== undefined && rol.nombre !== "admin") {
      validarPermisos(data.permisos)
      payload.permisos = data.permisos
    }

    return RolRepository.update(id, payload)
  }

  static async delete(id: number) {
    const rol = await RolRepository.findById(id)
    if (!rol) throw new HttpError(404, "Rol no encontrado")

    if (ROLES_SISTEMA.includes(rol.nombre)) {
      throw new HttpError(409, `"${rol.nombre}" es un rol del sistema y no puede eliminarse`)
    }

    const count = await RolRepository.countUsuariosByRol(id)
    if (count > 0) {
      throw new HttpError(409, `El rol tiene ${count} usuario(s) asignado(s); reasignalos antes de eliminarlo`)
    }

    await RolRepository.delete(id)
    return true
  }
}
