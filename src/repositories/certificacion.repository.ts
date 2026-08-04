import { createClient } from "@/lib/supabase/service"
import { esSinFilas } from "./base.repository"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import type { Certificacion, CertRollup, EstadoAprobacion, LocRollup } from "@/models"

const TABLE = "gu_certificaciones"
const TABLE_LINEAS = "gu_lineasdecertificacion"
const TABLE_LINEAS_OC = "gu_lineasdeordenesdecompra"

// Repositorio de gu_certificaciones (+ líneas): solo I/O. En la DB viven el número
// (fn_num_cert), el derivado de líneas, la regla del 100%, la OC aprobada y el rollup de avance.
export class CertificacionRepository {
  // La CE cuelga de UNA OC y hereda su proveedor. Ya no hay proyecto_id.
  static async findAllWithRelations(): Promise<any[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select("*, gu_proveedores(nombre), gu_ordenesdecompra(id, numero_oc, moneda)")
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  }

  static async findByIdWithRelations(id: number): Promise<any | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select("*, gu_proveedores(nombre, cuit, email), gu_ordenesdecompra(id, numero_oc, moneda)")
      .eq("id", id)
      .maybeSingle()

    if (error || !data) return null
    return data
  }

  // Devuelve las líneas con avance_monto/avance_porcentaje/numero_lce ya derivados.
  static async findLineasByCertId(certId: number): Promise<any[]> {
    const supabase = createClient()
    const { data } = await supabase
      .from(TABLE_LINEAS)
      .select("*, gu_lineasdeordenesdecompra(id, numero_loc, descripcion, cantidad, precio_unitario_neto)")
      .eq("certificacion_id", certId)
      .order("id", { ascending: true })

    return data || []
  }

  static async insert(cert: TablesInsert<"gu_certificaciones">): Promise<Certificacion> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).insert(cert).select().single()
    if (error) throw error
    return data
  }

  static async insertLineas(lineas: TablesInsert<"gu_lineasdecertificacion">[]): Promise<void> {
    if (!lineas || lineas.length === 0) return
    const supabase = createClient()
    const { error } = await supabase.from(TABLE_LINEAS).insert(lineas)
    if (error) throw error
  }

  static async update(id: number, data: TablesUpdate<"gu_certificaciones">): Promise<Certificacion | null> {
    const supabase = createClient()
    const { data: updated, error } = await supabase.from(TABLE).update(data).eq("id", id).select().single()
    if (error) {
      if (esSinFilas(error)) return null
      throw error
    }
    return updated
  }

  // Transición de estado. Si un trigger la rechaza, el error sube como P0001 -> 422.
  static async updateEstado(id: number, estado: EstadoAprobacion): Promise<Certificacion> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).update({ estado }).eq("id", id).select().single()
    if (error) throw error
    return data
  }

  static async deleteById(id: number): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE).delete().eq("id", id)
    if (error) throw error
    return true
  }

  // Líneas certificables de UNA orden de compra (la CE cuelga de una sola).
  static async findLineasDisponibles(ordenCompraId: number): Promise<any[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE_LINEAS_OC)
      .select("id, numero_loc, descripcion, cantidad, unidad_medida, precio_unitario_neto, iva_porcentaje")
      .eq("orden_compra_id", ordenCompraId)
      .order("id", { ascending: true })

    if (error) throw error
    return data || []
  }

  // Avance por línea de OC: lo calcula la vista (solo CE aprobadas), no la app.
  static async findLocRollups(ordenCompraId: number): Promise<LocRollup[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("v_loc_rollup")
      .select("*")
      .eq("orden_compra_id", ordenCompraId)

    if (error) throw error
    return data ?? []
  }

  // Estado de facturación de cada certificación (solo facturas finalizadas).
  static async findRollupsByIds(ids: number[]): Promise<CertRollup[]> {
    if (ids.length === 0) return []
    const supabase = createClient()
    const { data, error } = await supabase.from("v_cert_rollup").select("*").in("certificacion_id", ids)
    if (error) throw error
    return data ?? []
  }
}
