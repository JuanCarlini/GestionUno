import type { Database } from "@/lib/supabase/database.types"

type T = Database["public"]["Tables"]

// Fondo/medio desde el que se paga: catálogo con moneda propia (fn_op_gate exige que todas
// las cajas de una OP compartan la moneda de la OP). Baja lógica: hay líneas de OP apuntando.
export type Caja = T["gu_cajas"]["Row"]

export type CreateCajaData = Omit<T["gu_cajas"]["Insert"], "id" | "is_active" | "created_at">
export type UpdateCajaData = Omit<T["gu_cajas"]["Update"], "id" | "created_at">
