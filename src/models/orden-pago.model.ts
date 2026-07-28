import type { Database } from "@/lib/supabase/database.types"

type T = Database["public"]["Tables"]

export type OrdenPago = T["gu_ordenesdepago"]["Row"]
export type OrdenPagoLineaFactura = T["gu_lineasdeordenesdepago"]["Row"]
export type OrdenPagoLineaCaja = T["gu_lineasdeordenesdepagocaja"]["Row"]

// numero_op (OP-N) lo genera la DB; estado nace en 'borrador' (server-side).
// total_a_pagar lo recalcula la app a medida que se agregan facturas.
export type CreateOrdenPagoData = Omit<
  T["gu_ordenesdepago"]["Insert"],
  "id" | "numero_op" | "estado" | "total_a_pagar" | "created_at" | "updated_at"
>

// La OP paga N facturas (solo 'finalizado') y reparte el total en N cajas de la misma
// moneda. fn_op_gate valida Σcajas = Σfacturas = total_a_pagar al mandar a aprobar.
export interface CreateLineaFactura {
  factura_id: number
  monto: number
}

export interface CreateLineaCaja {
  caja_id: number
  monto: number
}
