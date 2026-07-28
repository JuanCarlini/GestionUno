import { createClient } from "@/lib/supabase/service"
import { Item, CreateItemDTO, UpdateItemDTO } from "@/models"
import { createBaseRepository } from "./base.repository"

const TABLE = "gu_items"
const TABLE_LINEAS_OC = "gu_lineasdeordenesdecompra"

// findAll/findById/insert/update usan el CRUD estándar; búsqueda, baja lógica, categorías y "en uso"
// son custom. Solo I/O — el default is_active, el dedup de categorías y "en uso" viven en ItemService.
const base = createBaseRepository<Item, CreateItemDTO & { is_active: boolean }, UpdateItemDTO>(
  TABLE,
  { orderBy: { column: "nombre", ascending: true } }
)

export const ItemRepository = {
  findAll: base.findAll,
  findById: base.findById,
  insert: base.insert,
  update: base.update,

  async findAllActive(): Promise<Item[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("is_active", true)
      .order("nombre", { ascending: true })

    if (error) throw error
    return data || []
  },

  // `query` viene saneado por ItemService.search (la coma cortaría el filtro .or()).
  async search(query: string): Promise<Item[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("is_active", true)
      .or(`codigo.ilike.%${query}%,nombre.ilike.%${query}%,descripcion.ilike.%${query}%`)
      .order("nombre", { ascending: true })
      .limit(20)

    if (error) throw error
    return data || []
  },

  async setActive(id: number, isActive: boolean): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE).update({ is_active: isActive }).eq("id", id)
    return !error
  },

  // ¿el item aparece en alguna línea de OC? (existencia; error se trata como "no en uso")
  async existsInLineasOC(itemId: number): Promise<boolean> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE_LINEAS_OC)
      .select("id")
      .eq("item_id", itemId)
      .limit(1)

    if (error) return false
    return (data?.length ?? 0) > 0
  },

  async findByCategoria(categoria: string): Promise<Item[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("is_active", true)
      .eq("categoria", categoria)
      .order("nombre", { ascending: true })

    if (error) throw error
    return data || []
  },

  // Valores crudos de 'categoria' (activos, no nulos). El dedup/orden lo hace el service.
  async findCategoriaValues(): Promise<(string | null)[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select("categoria")
      .eq("is_active", true)
      .not("categoria", "is", null)

    if (error) return []
    return (data || []).map((row: { categoria: string | null }) => row.categoria)
  },
}
