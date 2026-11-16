import { createClient } from "@/lib/supabase/service"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"

const TABLE = "gu_usuario"
// Nunca exponer password_hash: todas las lecturas de vuelta usan esta proyección.
const SELECT_SIN_HASH = "id, nombre, email, rol_id, estado, created_at, gu_roles(nombre)"

// Fila con el hash, para los dos únicos caminos que lo necesitan: verificar la clave en el
// login y verificar la clave actual antes de cambiarla. Cualquier otra lectura va por
// SELECT_SIN_HASH.
export interface UsuarioConHash {
  id: number
  email: string
  nombre: string
  password_hash: string
  rol_id: number
  estado: "activo" | "inactivo" | null
  gu_roles: unknown
}

// Repositorio de gu_usuario: solo I/O — el hasheo de contraseñas y la unicidad de email
// viven en UsuarioService. El repo estampa updated_at en cada mutación.
export class UsuarioRepository {
  // Login: necesita el hash para comparar, así que es la única lectura que lo trae (junto con
  // findHashById). Filtra por estado activo: un usuario inactivo no entra, y hacerlo en la
  // query evita que el service se olvide.
  static async findActivoParaLogin(email: string): Promise<UsuarioConHash | null> {
    const supabase = createClient()
    const { data } = await supabase
      .from(TABLE)
      .select("id, email, nombre, password_hash, rol_id, estado, gu_roles(nombre)")
      .eq("email", email)
      .eq("estado", "activo")
      .maybeSingle()
    return (data as UsuarioConHash | null) ?? null
  }

  // Usuario de la sesión. updated_at viaja porque session-freshness lo compara con el iat del
  // token para invalidar sesiones emitidas antes de un cambio de credencial.
  static async findActivoConRol(id: number): Promise<Record<string, unknown> | null> {
    const supabase = createClient()
    const { data } = await supabase
      .from(TABLE)
      .select("id, email, nombre, rol_id, estado, updated_at, gu_roles(nombre)")
      .eq("id", id)
      .eq("estado", "activo")
      .maybeSingle()
    return (data as Record<string, unknown> | null) ?? null
  }

  // Solo el hash, para verificar la clave actual en el cambio de contraseña.
  static async findHashById(id: number): Promise<string | null> {
    const supabase = createClient()
    const { data } = await supabase.from(TABLE).select("password_hash").eq("id", id).maybeSingle()
    return (data as { password_hash: string } | null)?.password_hash ?? null
  }

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
