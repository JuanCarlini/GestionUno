import { createClient } from "@/lib/supabase/service"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import type { Caja } from "@/models"
import { createBaseRepository } from "./base.repository"

const TABLE = "gu_cajas"

// findAll/insert/update usan el CRUD estándar; findAllActive, findById y setActive quedan custom.
// Solo I/O — el default is_active, la baja lógica y la inmutabilidad de la moneda viven en CajaService.
const base = createBaseRepository<Caja, TablesInsert<"gu_cajas">, TablesUpdate<"gu_cajas">>(
  TABLE,
  { orderBy: { column: "nombre", ascending: true } }
)

export const CajaRepository = {
  findAll: base.findAll,
  insert: base.insert,
  update: base.update,

  async findAllActive(): Promise<Caja[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("is_active", true)
      .order("nombre", { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async findById(id: number): Promise<Caja | null> {
    const supabase = createClient()
    const { data } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle()
    return data
  },

  async setActive(id: number, isActive: boolean): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE).update({ is_active: isActive }).eq("id", id)
    if (error) throw error
    return true
  },
}
