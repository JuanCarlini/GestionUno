import { createClient } from "@/lib/supabase/service"
import { esSinFilas } from "./base.repository"
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types"

const TABLE = "gu_roles"

// Repositorio de gu_roles: solo I/O — la protección de roles de sistema, la unicidad y las
// guardas de borrado (rol en uso) viven en RolService.
export class RolRepository {
  static async findAllOrdered(): Promise<any[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, nombre, descripcion, permisos")
      .order("id", { ascending: true })

    if (error) throw error
    return data || []
  }

  static async findById(id: number): Promise<{ id: number; nombre: string } | null> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).select("id, nombre").eq("id", id).single()
    if (error) {
      if (esSinFilas(error)) return null
      throw error
    }
    return data as { id: number; nombre: string } | null
  }

  static async findByNombre(nombre: string): Promise<{ id: number } | null> {
    const supabase = createClient()
    const { data } = await supabase.from(TABLE).select("id").eq("nombre", nombre).maybeSingle()
    return (data as { id: number } | null) ?? null
  }

  // Permisos (claves `modulo:accion`) de un rol por nombre. Fuente para requirePermission
  // (RBAC). Rol inexistente o sin permisos → []. Única capa con .from().
  static async findPermisosByNombre(nombre: string): Promise<string[]> {
    const supabase = createClient()
    const { data } = await supabase.from(TABLE).select("permisos").eq("nombre", nombre).maybeSingle()
    return data?.permisos ?? []
  }

  // rol_id de todos los usuarios, para contar cuántos hay por rol (usado en getAll)
  static async findAllUsuarioRolIds(): Promise<number[]> {
    const supabase = createClient()
    const { data, error } = await supabase.from("gu_usuario").select("rol_id")
    if (error) throw error
    return (data || []).map((u: any) => u.rol_id)
  }

  static async countUsuariosByRol(rolId: number): Promise<number> {
    const supabase = createClient()
    const { count, error } = await supabase
      .from("gu_usuario")
      .select("id", { count: "exact", head: true })
      .eq("rol_id", rolId)

    if (error) throw error
    return count ?? 0
  }

  static async insert(rol: { nombre: string; descripcion: string | null; permisos?: string[] }): Promise<Tables<"gu_roles">> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).insert(rol).select().single()
    if (error) throw error
    return data
  }

  static async update(id: number, payload: TablesUpdate<"gu_roles">): Promise<Tables<"gu_roles">> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).update(payload).eq("id", id).select().single()
    if (error) throw error
    return data
  }

  static async delete(id: number): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE).delete().eq("id", id)
    if (error) throw error
  }
}
