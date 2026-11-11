import { createClient } from "@/lib/supabase/service"
import { esSinFilas } from "./base.repository"
import { rpcFila } from "./rpc"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import type { EstadoAprobacion, LocRollup, OcRollup } from "@/models"
import {
  OrdenCompra,
  OrdenCompraLinea,
  OrdenCompraLineaConItem,
  CreateOrdenCompraLinea,
} from "@/models/orden-compra.model"

const TABLE = "gu_ordenesdecompra"
const TABLE_LINEAS = "gu_lineasdeordenesdecompra"

// Línea lista para persistir, sin orden_compra_id: en el alta transaccional la cabecera
// todavía no existe cuando la app arma las líneas, y el id lo pone la función.
export type LineaNueva = Omit<CreateOrdenCompraLinea, "orden_compra_id">

// Repositorio de gu_ordenesdecompra (+ líneas): solo I/O — el cálculo de totales de línea
// vive en OrdenCompraService. El alta va por fn_crear_orden_compra: cabecera y líneas en una
// transacción, así que ya no hay compensación anti-huérfanas que mantener.
export class OrdenCompraRepository {
  static async findAll(): Promise<OrdenCompra[]> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).select("*").order("created_at", { ascending: false })
    if (error) throw error
    return (data || []) as OrdenCompra[]
  }

  static async findById(id: number): Promise<OrdenCompra | null> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).single()
    if (error) {
      if (esSinFilas(error)) return null
      throw error
    }
    return data as OrdenCompra
  }

  // Alta completa en una transacción. Las líneas llegan SIN orden_compra_id: lo asigna la
  // función con el id que acaba de generar la cabecera.
  static async crearConLineas(
    cabecera: TablesInsert<"gu_ordenesdecompra">,
    lineas: LineaNueva[]
  ): Promise<OrdenCompra> {
    return rpcFila<OrdenCompra>("fn_crear_orden_compra", {
      p_cabecera: cabecera,
      p_lineas: lineas,
    })
  }

  // Inserta líneas y las devuelve (usado por createLines).
  static async insertLineasReturning(lineas: CreateOrdenCompraLinea[]): Promise<OrdenCompraLinea[]> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE_LINEAS).insert(lineas).select()
    if (error) throw error
    return (data || []) as OrdenCompraLinea[]
  }

  static async findLineasByOrdenId(ordenId: number): Promise<any[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE_LINEAS)
      .select("*")
      .eq("orden_compra_id", ordenId)
      .order("id", { ascending: true })

    if (error) throw error
    return data || []
  }

  static async update(id: number, payload: TablesUpdate<"gu_ordenesdecompra">): Promise<OrdenCompra> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).update(payload).eq("id", id).select().single()
    if (error) throw error
    return data as OrdenCompra
  }

  // Transición de estado. El gate (fn_oc_gate: >=1 línea) es un trigger: si rebota,
  // el error sube como P0001 y la ruta lo traduce a 422 con el mensaje de la DB.
  // Update CONDICIONAL: filtra también por el estado que la app leyó antes de validar la
  // transición. Si otro usuario ya movió el documento, no afecta ninguna fila y devuelve
  // null; el service lo convierte en 409 en vez de pisar el cambio del otro.
  static async updateEstado(
    id: number,
    estado: EstadoAprobacion,
    estadoEsperado: EstadoAprobacion
  ): Promise<OrdenCompra | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .update({ estado })
      .eq("id", id)
      .eq("estado", estadoEsperado)
      .select()
      .maybeSingle()
    if (error) throw error
    return data as OrdenCompra
  }

  // Rollups: los publica la vista v_oc_rollup (security_invoker). No se recalculan en JS.
  static async findRollupsByIds(ids: number[]): Promise<OcRollup[]> {
    if (ids.length === 0) return []
    const supabase = createClient()
    const { data, error } = await supabase.from("v_oc_rollup").select("*").in("orden_compra_id", ids)
    if (error) throw error
    return data ?? []
  }

  // Rollup por línea (unidades certificadas/pendientes) para el detalle de la OC.
  static async findLocRollups(ordenId: number): Promise<LocRollup[]> {
    const supabase = createClient()
    const { data, error } = await supabase.from("v_loc_rollup").select("*").eq("orden_compra_id", ordenId)
    if (error) throw error
    return data ?? []
  }

  static async deleteById(id: number): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE).delete().eq("id", id)
    if (error) throw error
    return true
  }

  static async findLineasWithItems(ordenId: number): Promise<OrdenCompraLineaConItem[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE_LINEAS)
      .select("*, item:gu_items(id, codigo, nombre, descripcion, unidad_medida, categoria)")
      .eq("orden_compra_id", ordenId)
      .order("id", { ascending: true })

    if (error) throw error
    return (data ?? []) as unknown as OrdenCompraLineaConItem[]
  }

  // Línea por id (para recalcular totales en updateLine). Error/no encontrada -> null.
  static async findLineaById(lineaId: number): Promise<any | null> {
    const supabase = createClient()
    const { data } = await supabase.from(TABLE_LINEAS).select("*").eq("id", lineaId).single()
    return data ?? null
  }

  static async insertLinea(linea: CreateOrdenCompraLinea): Promise<OrdenCompraLinea> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE_LINEAS).insert(linea).select().single()
    if (error) throw error
    return data as OrdenCompraLinea
  }

  static async updateLinea(
    lineaId: number,
    updates: Partial<CreateOrdenCompraLinea>
  ): Promise<OrdenCompraLinea | null> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE_LINEAS).update(updates).eq("id", lineaId).select().single()
    if (error) {
      if (esSinFilas(error)) return null
      throw error
    }
    return data as OrdenCompraLinea
  }

  static async deleteLinea(lineaId: number): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE_LINEAS).delete().eq("id", lineaId)
    if (error) throw error
    return true
  }
}
