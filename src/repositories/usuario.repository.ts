import { createClient } from "@/lib/supabase/service"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"

const TABLE = "gu_usuario"
// Nunca exponer password_hash: todas las lecturas de vuelta usan esta proyección.
const SELECT_SIN_HASH = "id, nombre, email, rol_id, estado, created_at, gu_roles(nombre)"

// Repositorio de gu_usuario: solo I/O — el hasheo de contraseñas y la unicidad de email
// viven en UsuarioService. El repo estampa updated_at en cada mutación.
export class UsuarioRepository {
  static async findByEmail(email: string): Promise<{ id: number } | null> {
    const supabase = createClient()
    const { data } = await supabase.from(TABLE).select("id").eq("email", email).maybeSingle()
    return (data as { id: number } | null) ?? null
  }

  // Proyección sin hash + nombre del rol (para la guarda anti auto-lockout del cambio de rol).
  static async findById(id: number): Promise<any | null> {
    const supabase = createClient()
    const { data } = await supabase.from(TABLE).select(SELECT_SIN_HASH).eq("id", id).maybeSingle()
    return data ?? null
  }

  // Listado con el rol (id + nombre) para la pantalla de administración de usuarios.
  static async findAllConRoles(): Promise<any[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, email, nombre, rol_id, estado, created_at, gu_roles(id, nombre)")
      .order("created_at", { ascending: false })
    if (error) throw error
    return data || []
  }

  static async insert(usuario: TablesInsert<"gu_usuario">): Promise<any> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).insert(usuario).select(SELECT_SIN_HASH).single()
    if (error) throw error
    return data
  }

  static async update(id: number, data: TablesUpdate<"gu_usuario">): Promise<any> {
    const supabase = createClient()
    const { data: actualizado, error } = await supabase
      .from(TABLE)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(SELECT_SIN_HASH)
      .single()

    if (error) throw error
    return actualizado
  }

  static async updatePassword(id: number, passwordHash: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from(TABLE)
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error
  }
}
