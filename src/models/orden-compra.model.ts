import type { Database } from "@/lib/supabase/database.types"

type T = Database["public"]["Tables"]

export type OrdenCompra = T["gu_ordenesdecompra"]["Row"]
export type OrdenCompraLinea = T["gu_lineasdeordenesdecompra"]["Row"]

// La app manda solo lo que la DB no genera: id/numero_oc/created_at/updated_at los pone
// la DB, y `estado` lo fija el server en 'borrador'. Los totales SÍ los calcula la app.
export type CreateOrdenCompraData = Omit<
  T["gu_ordenesdecompra"]["Insert"],
  "id" | "numero_oc" | "estado" | "created_at" | "updated_at"
>

export type CreateOrdenCompraLinea = Omit<
  T["gu_lineasdeordenesdecompra"]["Insert"],
  "id" | "numero_loc"
>

// Línea con el item del catálogo resuelto (join a gu_items).
export type OrdenCompraLineaConItem = OrdenCompraLinea & {
  item: Pick<
    T["gu_items"]["Row"],
    "id" | "codigo" | "nombre" | "descripcion" | "unidad_medida" | "categoria"
  > | null
}

// Lo que manda la UI al agregar una línea. Si no manda precio, se hereda de
// gu_item_proveedor_precio para el proveedor de la OC; si lo manda, se guarda ahí.
export interface CreateLineaFromItem {
  item_id: number
  cantidad: number
  precio_unitario_neto?: number
  iva_porcentaje?: number
  descripcion?: string
}
