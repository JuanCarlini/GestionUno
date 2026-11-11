import { createClient } from "@/lib/supabase/service"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import type { OrdenPago, OrdenPagoLineaFactura, OrdenPagoLineaCaja, EstadoOp } from "@/models"
import { rango, type Orden, type Pagina, type Paginacion } from "@/lib/route/paginacion"
import { orIlike, type FiltrosListado } from "./filtros"

const TABLE = "gu_ordenesdepago"
const TABLE_LINEAS = "gu_lineasdeordenesdepago"
const TABLE_CAJAS = "gu_lineasdeordenesdepagocaja"

// Repositorio de gu_ordenesdepago (+ líneas de factura y caja): solo I/O. En la DB viven
// el número (fn_num_op), el gate de pago (fn_op_gate) y la validación de factura pagable.
export class OrdenPagoRepository {
  static async findPaginaWithProveedor(
    p: Paginacion,
    opts: { filtros?: FiltrosListado; orden?: Orden } = {}
  ): Promise<Pagina<any>> {
    const supabase = createClient()
    const o = opts.orden ?? { columna: "created_at", ascending: false }
    const { desde, hasta } = rango(p)
    const f = opts.filtros ?? {}

    let q = supabase.from(TABLE).select("*, gu_proveedores(nombre)", { count: "exact" })
    // El estado ya viene validado contra el enum en la ruta; el cliente tipado pide el
    // literal y el filtro llega como string de la query.
    if (f.estado) q = q.eq("estado", f.estado as never)
    if (f.proveedorId) q = q.eq("proveedor_id", f.proveedorId)

    const texto = orIlike(f.q, ["numero_op", "observaciones"])
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
      .select("*, gu_proveedores(nombre)")
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  }

  static async findByIdWithProveedor(id: number): Promise<any | null> {
    const supabase = createClient()
    const { data } = await supabase
      .from(TABLE)
      .select("*, gu_proveedores(nombre, cuit, email)")
      .eq("id", id)
      .maybeSingle()
    return data
  }

  static async findById(id: number): Promise<OrdenPago | null> {
    const supabase = createClient()
    const { data } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle()
    return data
  }

  static async insert(orden: TablesInsert<"gu_ordenesdepago">): Promise<OrdenPago> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).insert(orden).select().single()
    if (error) throw error
    return data
  }

  static async update(id: number, payload: TablesUpdate<"gu_ordenesdepago">): Promise<OrdenPago> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE).update(payload).eq("id", id).select().single()
    if (error) throw error
    return data
  }

  // Update CONDICIONAL: filtra también por el estado que la app leyó antes de validar la
  // transición. Si otro usuario ya movió el documento, no afecta ninguna fila y devuelve
  // null; el service lo convierte en 409 en vez de pisar el cambio del otro.
  static async updateEstado(
    id: number,
    estado: EstadoOp,
    estadoEsperado: EstadoOp
  ): Promise<OrdenPago | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .update({ estado })
      .eq("id", id)
      .eq("estado", estadoEsperado)
      .select()
      .maybeSingle()
    if (error) throw error // fn_op_gate llega acá como P0001
    return data
  }

  static async delete(id: number): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE).delete().eq("id", id)
    if (error) throw error
    return true
  }

  // --- Líneas de factura (qué facturas paga la OP). fn_lop_factura_pagable valida cada insert.
  static async findLineasFactura(opId: number): Promise<any[]> {
    const supabase = createClient()
    const { data } = await supabase
      .from(TABLE_LINEAS)
      .select("id, factura_id, monto, gu_facturas(numero_factura, total_facturado, moneda)")
      .eq("orden_pago_id", opId)
    return data || []
  }

  static async insertLineaFactura(
    linea: TablesInsert<"gu_lineasdeordenesdepago">
  ): Promise<OrdenPagoLineaFactura> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE_LINEAS).insert(linea).select().single()
    if (error) throw error
    return data
  }

  static async deleteLineaFactura(opId: number, facturaId: number): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase
      .from(TABLE_LINEAS)
      .delete()
      .eq("orden_pago_id", opId)
      .eq("factura_id", facturaId)
    if (error) throw error
    return true
  }

  // --- Líneas de caja (desde qué cajas se paga). fn_op_gate valida moneda y Σ al mandar a aprobar.
  static async findLineasCaja(opId: number): Promise<any[]> {
    const supabase = createClient()
    const { data } = await supabase
      .from(TABLE_CAJAS)
      .select("id, caja_id, monto, gu_cajas(nombre, tipo, moneda)")
      .eq("orden_pago_id", opId)
    return data || []
  }

  static async insertLineaCaja(
    linea: TablesInsert<"gu_lineasdeordenesdepagocaja">
  ): Promise<OrdenPagoLineaCaja> {
    const supabase = createClient()
    const { data, error } = await supabase.from(TABLE_CAJAS).insert(linea).select().single()
    if (error) throw error
    return data
  }

  static async deleteLineaCaja(opId: number, cajaId: number): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase
      .from(TABLE_CAJAS)
      .delete()
      .eq("orden_pago_id", opId)
      .eq("caja_id", cajaId)
    if (error) throw error
    return true
  }
}
