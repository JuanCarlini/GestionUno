import type { Database } from "@/lib/supabase/database.types"

type T = Database["public"]["Tables"]

export type Certificacion = T["gu_certificaciones"]["Row"]

// El ÚNICO input de una línea de certificación es avance_unidades: avance_monto,
// avance_porcentaje, iva_porcentaje y numero_lce los deriva el trigger fn_lce_derive.
export interface CreateCertificacionLinea {
  linea_oc_id: number
  avance_unidades: number
}

// Línea de OC certificable, leída de v_loc_rollup (no se recalcula el avance en JS).
export interface LineaOCDisponible {
  linea_oc_id: number
  orden_compra_id: number
  numero_loc: string | null
  descripcion: string
  cantidad: number
  unidades_certificadas: number
  unidades_pendientes: number
  monto_pendiente: number
  precio_unitario_neto: number
  iva_porcentaje: number
}
