import { createClient } from "@/lib/supabase/service"

const TABLE = "gu_item_proveedor_precio"

// Puente N:M item↔proveedor: el precio vive acá y la lista se arma sola. Al cargar una línea
// de OC, si el par (item, proveedor) no existe se inserta como referencia; si existe, se hereda.
export class ItemPrecioRepository {
  static async findPrecio(itemId: number, proveedorId: number): Promise<number | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select("precio")
      .eq("item_id", itemId)
      .eq("proveedor_id", proveedorId)
      .maybeSingle()

    if (error) throw error
    return data ? Number(data.precio) : null
  }

  static async upsertPrecio(itemId: number, proveedorId: number, precio: number): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { item_id: itemId, proveedor_id: proveedorId, precio },
        { onConflict: "item_id,proveedor_id" }
      )
    if (error) throw error
  }

  // Lista de precios de un proveedor (para el selector de items de la OC).
  static async findPreciosByProveedor(proveedorId: number) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select("item_id, precio, gu_items(id, codigo, nombre, unidad_medida, is_active)")
      .eq("proveedor_id", proveedorId)

    if (error) throw error
    return data ?? []
  }
}
