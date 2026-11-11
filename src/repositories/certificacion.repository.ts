import { createClient } from "@/lib/supabase/service"
import { esSinFilas } from "./base.repository"
import { rpcFila } from "./rpc"
import { rango, type Orden, type Pagina, type Paginacion } from "@/lib/route/paginacion"
import { orIlike, type FiltrosListado } from "./filtros"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import type { Certificacion, CertRollup, EstadoAprobacion, LocRollup } from "@/models"

const TABLE = "gu_certificaciones"
const TABLE_LINEAS = "gu_lineasdecertificacion"
const TABLE_LINEAS_OC = "gu_lineasdeordenesdecompra"

// avance_unidades es el único input de una línea: el resto lo deriva fn_lce_derive.
export type LineaNuevaCert = { linea_oc_id: number; avance_unidades: number }

// Repositorio de gu_certificaciones (+ líneas): solo I/O. En la DB viven el número
// (fn_num_cert), el derivado de líneas, la regla del 100%, la OC aprobada y el rollup de avance.
export class CertificacionRepository {
  // La CE cuelga de UNA OC y hereda su proveedor. Ya no hay proyecto_id.
  static async findPaginaWithRelations(
    p: Paginacion,
    opts: { filtros?: FiltrosListado; orden?: Orden } = {}
  ): Promise<Pagina<any>> {
    const supabase = createClient()
    const o = opts.orden ?? { columna: "created_at", ascending: false }
    const { desde, hasta } = rango(p)
    const f = opts.filtros ?? {}

    let q = supabase
      .from(TABLE)
      .select("*, gu_proveedores(nombre), gu_ordenesdecompra(id, numero_oc, moneda)", {
        count: "exact",
      })
    // El estado ya viene validado contra el enum en la ruta; el cliente tipado pide el
    // literal y el filtro llega como string de la query.
    if (f.estado) q = q.eq("estado", f.estado as never)
    if (f.proveedorId) q = q.eq("proveedor_id", f.proveedorId)

    const texto = orIlike(f.q, ["numero_cert", "observaciones"])
    if (texto) q = q.or(texto)

    const { data, error, count } = await q
      .order(o.columna, { ascending: o.ascending })
      .range(desde, hasta)

    if (error) throw error
    return { data: data ?? [], total: count ?? 0 }
  }

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

  // Alta completa en una transacción. Las líneas llegan solo con linea_oc_id y
  // avance_unidades: el resto lo deriva fn_lce_derive, y si fn_check_avance_100 rechaza una,
  // se cae el alta entera en vez de dejar la cabecera colgada.
  static async crearConLineas(
    cabecera: TablesInsert<"gu_certificaciones">,
    lineas: LineaNuevaCert[]
  ): Promise<Certificacion> {
    return rpcFila<Certificacion>("fn_crear_certificacion", {
      p_cabecera: cabecera,
      p_lineas: lineas,
    })
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
  // Update CONDICIONAL: filtra también por el estado que la app leyó antes de validar la
  // transición. Si otro usuario ya movió el documento, no afecta ninguna fila y devuelve
  // null; el service lo convierte en 409 en vez de pisar el cambio del otro.
  static async updateEstado(
    id: number,
    estado: EstadoAprobacion,
    estadoEsperado: EstadoAprobacion
  ): Promise<Certificacion | null> {
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
