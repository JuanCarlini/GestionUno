import type { Database } from "@/lib/supabase/database.types"

type T = Database["public"]["Tables"]

export type Factura = T["gu_facturas"]["Row"]

// numero_factura (FACT-N) lo genera la DB. numero_comprobante/punto_venta son del proveedor.
export type CreateFacturaData = Omit<
  T["gu_facturas"]["Insert"],
  "id" | "numero_factura" | "estado" | "created_at" | "updated_at"
>

// Ojo: la columna es `precio_unitario` (no `precio_unitario_neto`, como en LOC).
export type CreateFacturaLinea = Omit<T["gu_lineasdefactura"]["Insert"], "id" | "factura_id">

// Imputación N:M a certificaciones. El trigger fn_check_imputacion exige cert aprobada
// y que Σ monto_asignado ≤ Σ total_con_iva de las líneas de la factura.
export interface CreateImputacion {
  certificacion_id: number
  monto_asignado: number
}
