import type { Database } from "@/lib/supabase/database.types"

type Enums = Database["public"]["Enums"]

// Única fuente: el schema. Si un enum cambia en la DB y se regeneran los tipos,
// los `satisfies` de abajo rompen la compilación en vez de fallar en runtime.
export type EstadoAprobacion = Enums["estado_aprobacion"] // OC y CE
export type EstadoFactura = Enums["estado_factura"]
export type EstadoOp = Enums["estado_op"]
export type EstadoRollup = Enums["estado_rollup"]
export type CajaTipo = Enums["caja_tipo"]
export type Moneda = Enums["moneda_enum"]

export const ESTADOS_APROBACION = [
  "borrador", "en_aprobacion", "aprobado", "rechazado", "anulado",
] as const satisfies readonly EstadoAprobacion[]

export const ESTADOS_FACTURA = [
  "borrador", "finalizado", "anulado",
] as const satisfies readonly EstadoFactura[]

export const ESTADOS_OP = [
  "borrador", "en_aprobacion", "aprobado", "pagado", "rechazado", "anulado",
] as const satisfies readonly EstadoOp[]

export const CAJA_TIPOS = [
  "banco", "efectivo", "cheque", "transferencia",
] as const satisfies readonly CajaTipo[]

export const MONEDAS = ["ARS", "USD", "EUR"] as const satisfies readonly Moneda[]

// El enum de la DB dice 'en_aprobacion'; la pantalla dice "Esperando aprobación".
// 'pagado' existe SOLO en estado_op — nunca en facturas.
export const LABEL_ESTADO: Record<
  EstadoAprobacion | EstadoFactura | EstadoOp | EstadoRollup,
  string
> = {
  borrador: "Borrador",
  en_aprobacion: "Esperando aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  anulado: "Anulado",
  finalizado: "Finalizado",
  pagado: "Pagado",
  sin: "Sin certificar",
  parcial: "Parcial",
  total: "Total",
}
