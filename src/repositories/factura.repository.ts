import { createClient } from "@/lib/supabase/service"
import { esSinFilas } from "./base.repository"
import { rpcFila } from "./rpc"
import { rango, type Orden, type Pagina, type Paginacion } from "@/lib/route/paginacion"
import { orIlike, type FiltrosListado } from "./filtros"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import type { Factura, FacturaRollup, EstadoFactura } from "@/models"

const TABLE = "gu_facturas"
const TABLE_LINEAS = "gu_lineasdefactura"
const TABLE_CERTS = "gu_facturas_certificaciones"

// Sin factura_id: en el alta transaccional lo asigna la función con el id de la cabecera.
export type LineaNuevaFactura = Omit<TablesInsert<"gu_lineasdefactura">, "id" | "factura_id">
export type ImputacionNueva = { certificacion_id: number; monto_asignado: number }

// Repositorio de gu_facturas (+ líneas + puente N:M con certificaciones): solo I/O. En la DB
// viven el número (fn_num_fact), la regla de imputación (fn_check_imputacion) y el rollup de pago.
export class FacturaRepository {
  static async findPaginaWithProveedor(
    p: Paginacion,
    opts: { filtros?: FiltrosListado; orden?: Orden } = {}
  ): Promise<Pagina<any>> {
    const supabase = createClient()
    const o = opts.orden ?? { columna: "created_at", ascending: false }
    const { desde, hasta } = rango(p)
    const f = opts.filtros ?? {}

    let q = supabase.from(TABLE).select("*, gu_proveedores(nombre, cuit)", { count: "exact" })
    // El estado ya viene validado contra el enum en la ruta; el cliente tipado pide el
    // literal y el filtro llega como string de la query.
    if (f.estado) q = q.eq("estado", f.estado as never)
    if (f.proveedorId) q = q.eq("proveedor_id", f.proveedorId)

    const texto = orIlike(f.q, ["numero_factura", "numero_comprobante", "observaciones"])
    if (texto) q = q.or(texto)

    const { data, error, count } = await q
      .order(o.columna, { ascending: o.ascending })
      .range(desde, hasta)

    if (error) throw error
    return { data: data ?? [], total: count ?? 0 }
  }

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

  // Certificaciones aprobadas del proveedor, para elegir a cuáles imputar. La moneda
  // viene de la OC (la cert no tiene columna propia).
  static async findCertificacionesAprobadas(proveedorId: number): Promise<any[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("gu_certificaciones")
      .select("id, numero_cert, fecha_devengado, total_neto, total_con_iva, gu_ordenesdecompra(moneda)")
      .eq("proveedor_id", proveedorId)
      .eq("estado", "aprobado")
      .order("fecha_cert", { ascending: false })

    if (error) throw error
    return data || []
  }

  // Alta completa en una transacción: cabecera, líneas e imputaciones. Las líneas y las
  // imputaciones llegan sin factura_id, lo asigna la función.
  static async crearConLineas(
    cabecera: TablesInsert<"gu_facturas">,
    lineas: LineaNuevaFactura[],
    imputaciones: ImputacionNueva[]
  ): Promise<Factura> {
    return rpcFila<Factura>("fn_crear_factura", {
      p_cabecera: cabecera,
      p_lineas: lineas,
      p_imputaciones: imputaciones,
    })
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
    if (error) throw error
    return true
  }

  static async update(id: number, factura: TablesUpdate<"gu_facturas">): Promise<Factura | null> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).update(factura).eq("id", id).select().single()
    if (error) {
      if (esSinFilas(error)) return null
      throw error
    }
    return data
  }

  // Update CONDICIONAL: filtra también por el estado que la app leyó antes de validar la
  // transición. Si otro usuario ya movió el documento, no afecta ninguna fila y devuelve
  // null; el service lo convierte en 409 en vez de pisar el cambio del otro.
  static async updateEstado(
    id: number,
    estado: EstadoFactura,
    estadoEsperado: EstadoFactura
  ): Promise<Factura | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .update({ estado })
      .eq("id", id)
      .eq("estado", estadoEsperado)
      .select()
      .maybeSingle()
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
    if (error) throw error
    return true
  }
}
