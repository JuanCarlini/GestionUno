import type { Database } from "@/lib/supabase/database.types"

type T = Database["public"]["Tables"]

// El item es agnóstico al proveedor: el precio vive en gu_item_proveedor_precio (N:M).
// Por eso se fue `precio_sugerido`. `codigo` es UNIQUE y requerido.
export type Item = T["gu_items"]["Row"]

export type CreateItemDTO = Omit<
  T["gu_items"]["Insert"],
  "id" | "is_active" | "created_at" | "updated_at"
>

export type UpdateItemDTO = Omit<T["gu_items"]["Update"], "id" | "created_at" | "updated_at">

// Categorías comunes para items
export enum ItemCategoria {
  MATERIALES = 'Materiales',
  SERVICIOS = 'Servicios',
  EQUIPOS = 'Equipos',
  HERRAMIENTAS = 'Herramientas',
  SUMINISTROS = 'Suministros',
  OTROS = 'Otros'
}

// Unidades de medida comunes
export enum UnidadMedida {
  UNIDADES = 'unidades',
  KG = 'kg',
  LITROS = 'litros',
  METROS = 'metros',
  M2 = 'm²',
  M3 = 'm³',
  HORAS = 'horas',
  DIAS = 'días',
  CAJAS = 'cajas',
  BOLSAS = 'bolsas'
}
