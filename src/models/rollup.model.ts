import type { Database } from "@/lib/supabase/database.types"

// Rollups Sin/Parcial/Total: son VISTAS en la DB (security_invoker), no columnas.
// Se LEEN, no se recalculan en JS. Solo cuentan documentos aprobados/finalizados/pagados.
type V = Database["public"]["Views"]

export type LocRollup = V["v_loc_rollup"]["Row"]
export type OcRollup = V["v_oc_rollup"]["Row"]
export type CertRollup = V["v_cert_rollup"]["Row"]
export type FacturaRollup = V["v_factura_rollup"]["Row"]
