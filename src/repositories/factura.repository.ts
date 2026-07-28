import { createClient } from "@/lib/supabase/service"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import type { Factura, FacturaRollup, EstadoFactura } from "@/models"

const TABLE = "gu_facturas"
const TABLE_LINEAS = "gu_lineasdefactura"
const TABLE_CERTS = "gu_facturas_certificaciones"

// Repositorio de gu_facturas (+ líneas + puente N:M con certificaciones): solo I/O. En la DB
// viven el número (fn_num_fact), la regla de imputación (fn_check_imputacion) y el rollup de pago.
export class FacturaRepository {
  static async findAllWithProveedor(): Promise<any[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select(`*, gu_proveedores(nombre, cuit)`)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  }

  static async findByIdWithProveedor(id: number): Promise<any | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .select(`*, gu_proveedores(nombre, cuit, email, direccion)`)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) return null
    return data
  }

  // Cabecera cruda (para chequear estado en las transiciones/imputaciones).
  static async findById(id: number): Promise<Factura | null> {
    const supabase = createClient()
    const { data } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle()
    return data
  }

  static async findLineasByFacturaId(facturaId: number): Promise<any[]> {
    const supabase = createClient()
    const { data } = await supabase.from(TABLE_LINEAS).select("*").eq("factura_id", facturaId)
    return data || []
  }

  // Imputaciones N:M con su monto_asignado + la certificación embebida.
  static async findImputaciones(facturaId: number): Promise<any[]> {
    const supabase = createClient()
    const { data } = await supabase
      .from(TABLE_CERTS)
      .select(
        `id, certificacion_id, monto_asignado, gu_certificaciones(id, numero_cert, total_con_iva, estado)`
      )
      .eq("factura_id", facturaId)

    return data || []
  }

  // Certificaciones aprobadas del proveedor, para elegir a cuáles imputar.
  static async findCertificacionesAprobadas(proveedorId: number): Promise<any[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("gu_certificaciones")
      .select("id, numero_cert, fecha_devengado, total_neto, total_con_iva")
      .eq("proveedor_id", proveedorId)
      .eq("estado", "aprobado")
      .order("fecha_cert", { ascending: false })

    if (error) throw error
    return data || []
  }

  static async insert(factura: TablesInsert<"gu_facturas">): Promise<Factura> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).insert(factura).select().single()
    if (error) throw error
    return data
  }

  static async insertLineas(lineas: TablesInsert<"gu_lineasdefactura">[]): Promise<void> {
    if (!lineas || lineas.length === 0) return
    const supabase = createClient()
    const { error } = await supabase.from(TABLE_LINEAS).insert(lineas)
    if (error) throw error
  }

  // Insertar DESPUÉS de las LFACT: fn_check_imputacion compara contra Σtotal_con_iva de las
  // líneas (valida cert aprobada + tope, rebota como P0001 -> 422).
  static async insertImputaciones(
    imputaciones: TablesInsert<"gu_facturas_certificaciones">[]
  ): Promise<void> {
    if (!imputaciones || imputaciones.length === 0) return
    const supabase = createClient()
    const { error } = await supabase.from(TABLE_CERTS).insert(imputaciones)
    if (error) throw error
  }

  static async deleteImputacion(facturaId: number, certificacionId: number): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase
      .from(TABLE_CERTS)
      .delete()
      .eq("factura_id", facturaId)
      .eq("certificacion_id", certificacionId)
    return !error
  }

  static async update(id: number, factura: TablesUpdate<"gu_facturas">): Promise<Factura | null> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).update(factura).eq("id", id).select().single()
    if (error) return null
    return data
  }

  static async updateEstado(id: number, estado: EstadoFactura): Promise<Factura> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).update({ estado }).eq("id", id).select().single()
    if (error) throw error
    return data
  }

  // Estado de pago de cada factura (solo OPs pagadas).
  static async findRollupsByIds(ids: number[]): Promise<FacturaRollup[]> {
    if (ids.length === 0) return []
    const supabase = createClient()
    const { data, error } = await supabase.from("v_factura_rollup").select("*").in("factura_id", ids)
    if (error) throw error
    return data ?? []
  }

  static async deleteById(id: number): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE).delete().eq("id", id)
    return !error
  }
}
