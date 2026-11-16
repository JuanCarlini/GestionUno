import type { TablesUpdate } from "@/lib/supabase/database.types"
import { OrdenCompraRepository, type LineaNueva } from "@/repositories/orden-compra.repository"
import { ItemPrecioRepository } from "@/repositories/item-precio.repository"
import { HttpError } from "@/lib/route/http-error"
import { exigirCambioAplicado } from "@/lib/route/estado-route"
import { totalesDeLinea, IVA_DEFAULT } from "@/services/totales"
import { puedeTransicionar, TRANSICIONES_APROBACION } from "@/services/transiciones"
import {
  CreateOrdenCompraData,
  CreateOrdenCompraLinea,
  CreateLineaFromItem,
  EstadoAprobacion,
  OrdenCompra,
  OrdenCompraLinea,
  OrdenCompraLineaConItem,
} from "@/models"
import { ItemService } from "./item.service"
import type { Orden, Pagina, Paginacion } from "@/lib/route/paginacion"
import type { FiltrosListado } from "@/repositories/filtros"

// Una OC solo acepta cambios en sus líneas mientras es borrador (o rechazada): editar cantidades
// tras aprobarla falsearía el avance certificado y dejaría v_loc_rollup en negativo.
const ESTADOS_EDITABLES: EstadoAprobacion[] = ["borrador", "rechazado"]

// Quién pide el cambio. puedeAjenas = tiene 'ordenes_compra:aprobar' (supervisor/admin): puede
// corregir OCs de otros. El resto solo toca las que creó (created_by sale del JWT, no del body).
export interface Actor {
  id: number
  puedeAjenas: boolean
}

// Reglas de negocio de órdenes de compra (I/O en OrdenCompraRepository). Numeración, gate de
// ≥1 línea y rollups (v_oc_rollup / v_loc_rollup) viven en la DB.
export class OrdenCompraService {
  // Una página del listado, con el chip de estado de certificación leído de la vista. El
  // rollup se consulta solo para los ids de esta página.
  static async getPagina(
    p: Paginacion,
    opts: { filtros?: FiltrosListado; orden?: Orden } = {}
  ): Promise<Pagina<Record<string, unknown>>> {
    const { data: ordenes, total } = await OrdenCompraRepository.findPagina(p, opts)
    if (ordenes.length === 0) return { data: [], total }

    const rollups = await OrdenCompraRepository.findRollupsByIds(ordenes.map((o) => o.id))
    const porId = new Map(rollups.map((r) => [r.orden_compra_id, r]))

    return {
      total,
      data: ordenes.map((oc) => ({
        ...oc,
        estado_certificacion: porId.get(oc.id)?.estado_certificacion ?? "sin",
        monto_pendiente_certificar: Number(porId.get(oc.id)?.monto_pendiente_certificar ?? 0),
      })),
    }
  }

  static async getById(id: number): Promise<OrdenCompra | null> {
    return OrdenCompraRepository.findById(id)
  }

  // Crea la OC (cabecera + líneas opcionales) en UNA transacción (fn_crear_orden_compra).
  // numero_oc lo genera la DB y el estado lo fija la función; los totales de cabecera los
  // calcula la misma transacción desde las líneas persistidas.
  static async create(
    payload: CreateOrdenCompraData & { lineas?: CreateLineaFromItem[] },
    createdBy: number
  ): Promise<OrdenCompra> {
    const { lineas, ...ocData } = payload

    // Las líneas se arman ANTES del alta: el precio heredado del proveedor, la descripción
    // del item y los totales por línea son reglas de la app, no de la base.
    // Concurrente (I/O-bound): cada armarLinea hace su lookup de item + precio; en serie
    // eran ~2N round-trips secuenciales (N = líneas). Promise.all preserva el orden.
    const armadas = await Promise.all(
      (lineas ?? []).map((l) => OrdenCompraService.armarLinea(ocData.proveedor_id, l))
    )

    // Ya no hay compensación: si falla una línea, la transacción se cae entera y no queda
    // ninguna OC huérfana que borrar.
    return OrdenCompraRepository.crearConLineas({ ...ocData, created_by: createdBy }, armadas)
  }

  // Agrega una línea eligiendo un item del catálogo. Los totales de la cabecera los recalcula
  // trg_recalc_oc_cabecera en la misma transacción (migración totales_01_triggers_cabecera).
  static async addLinea(ocId: number, input: CreateLineaFromItem): Promise<OrdenCompraLinea> {
    const oc = await OrdenCompraService.getEditable(ocId)
    const armada = await OrdenCompraService.armarLinea(oc.proveedor_id, input)
    return OrdenCompraRepository.insertLinea({ ...armada, orden_compra_id: ocId })
  }

  // Alias histórico: la ruta POST /[id]/lineas lo llama así.
  static async createLineFromItem(ocId: number, input: CreateLineaFromItem) {
    return OrdenCompraService.addLinea(ocId, input)
  }

  /**
   * El precio vive en gu_item_proveedor_precio (por proveedor), no en el item: si la UI no lo
   * manda se hereda del par (item, proveedor); si lo manda se guarda ahí y arma la lista.
   */
  // Recibe el proveedor y no la OC: en el alta transaccional la cabecera todavía no existe
  // cuando se arman las líneas, y lo único que hace falta es el proveedor para el precio.
  private static async armarLinea(
    proveedorId: number,
    input: CreateLineaFromItem
  ): Promise<LineaNueva> {
    const item = await ItemService.getById(input.item_id)
    if (!item) throw new HttpError(404, `Item con ID ${input.item_id} no encontrado`)

    let precio = input.precio_unitario_neto
    if (precio === undefined) {
      const heredado = await ItemPrecioRepository.findPrecio(input.item_id, proveedorId)
      if (heredado === null) {
        throw new HttpError(
          422,
          `El item ${item.codigo} no tiene precio cargado para este proveedor: indicá un precio unitario`
        )
      }
      precio = heredado
    } else {
      await ItemPrecioRepository.upsertPrecio(input.item_id, proveedorId, precio)
    }

    const iva = input.iva_porcentaje ?? IVA_DEFAULT
    return {
      item_id: item.id,
      descripcion: input.descripcion || item.nombre,
      cantidad: input.cantidad,
      unidad_medida: item.unidad_medida,
      precio_unitario_neto: precio,
      iva_porcentaje: iva,
      ...totalesDeLinea(input.cantidad, precio, iva),
    }
  }

  // Actualizar una línea; si cambia cantidad/precio/IVA, recalcula sus totales. Los de la
  // cabecera los pone el trigger.
  static async updateLine(
    lineaId: number,
    updates: Partial<CreateOrdenCompraLinea>
  ): Promise<OrdenCompraLinea | null> {
    const actual = await OrdenCompraRepository.findLineaById(lineaId)
    if (!actual) throw new HttpError(404, "Línea no encontrada")
    await OrdenCompraService.getEditable(actual.orden_compra_id)

    if (
      updates.cantidad !== undefined ||
      updates.precio_unitario_neto !== undefined ||
      updates.iva_porcentaje !== undefined
    ) {
      Object.assign(
        updates,
        totalesDeLinea(
          updates.cantidad ?? actual.cantidad,
          updates.precio_unitario_neto ?? actual.precio_unitario_neto,
          updates.iva_porcentaje ?? actual.iva_porcentaje
        )
      )
    }

    return OrdenCompraRepository.updateLinea(lineaId, updates)
  }

  static async deleteLine(lineaId: number): Promise<boolean> {
    const actual = await OrdenCompraRepository.findLineaById(lineaId)
    if (!actual) throw new HttpError(404, "Línea no encontrada")
    await OrdenCompraService.getEditable(actual.orden_compra_id)

    return OrdenCompraRepository.deleteLinea(lineaId)
  }

  // Los totales de cabecera ya no se reescriben desde acá: los recalcula
  // trg_recalc_oc_cabecera sobre gu_lineasdeordenesdecompra, dentro de la misma transacción
  // que cambió la línea (ver supabase/migrations/..._totales_01_triggers_cabecera.sql). Dos
  // ediciones simultáneas se intercalaban entre el read y el write y dejaban el total viejo.

  // Pre-chequeo del grafo de estados (409). Los gates de negocio son triggers y devuelven 422:
  // acá no se reimplementan.
  static async cambiarEstado(id: number, destino: EstadoAprobacion): Promise<OrdenCompra> {
    const oc = await OrdenCompraRepository.findById(id)
    if (!oc) throw new HttpError(404, "Orden de compra no encontrada")

    if (!puedeTransicionar(TRANSICIONES_APROBACION, oc.estado, destino)) {
      throw new HttpError(409, `No se puede pasar de ${oc.estado} a ${destino}`)
    }

    // El estado leído arriba viaja al update: si cambió en el medio, 409.
    return exigirCambioAplicado(await OrdenCompraRepository.updateEstado(id, destino, oc.estado))
  }

  // La cabecera se protege como las líneas: sin esta guarda se podría reasignar el proveedor o la
  // moneda de una OC ya aprobada, y acá la app es el único control (la DB no lo cubre).
  static async update(
    id: number,
    payload: TablesUpdate<"gu_ordenesdecompra">,
    actor: Actor
  ): Promise<OrdenCompra | null> {
    const oc = await OrdenCompraService.getEditable(id)
    OrdenCompraService.verificarDueno(oc, actor)
    return OrdenCompraRepository.update(id, payload)
  }

  static async delete(id: number, actor: Actor): Promise<boolean> {
    const oc = await OrdenCompraService.getEditable(id)
    OrdenCompraService.verificarDueno(oc, actor)
    return OrdenCompraRepository.deleteById(id)
  }

  // Autorización por DUEÑO (además del permiso por rol que ya cortó la ruta): una OC ajena
  // no se modifica ni se borra salvo que el actor pueda aprobar. 403 y no 404: el usuario
  // tiene 'ordenes_compra:ver', así que la OC ya la ve; ocultar que existe no protege nada.
  static verificarDueno(oc: OrdenCompra, actor: Actor): void {
    if (actor.puedeAjenas) return
    if (oc.created_by !== actor.id) {
      throw new HttpError(403, "Solo quien creó la orden de compra puede modificarla o borrarla")
    }
  }

  static async getLinesByOrdenId(ordenId: number) {
    return OrdenCompraRepository.findLineasByOrdenId(ordenId)
  }

  // Líneas con el item del catálogo + su avance certificado (leído de v_loc_rollup).
  static async getLinesWithItems(ordenId: number): Promise<OrdenCompraLineaConItem[]> {
    return OrdenCompraRepository.findLineasWithItems(ordenId)
  }

  static async getLocRollups(ordenId: number) {
    return OrdenCompraRepository.findLocRollups(ordenId)
  }

  // Devuelve la OC si admite cambios (cabecera, líneas o borrado); si no, 404 / 422. El mensaje
  // es genérico a propósito: lo comparten los tres caminos.
  private static async getEditable(ocId: number): Promise<OrdenCompra> {
    const oc = await OrdenCompraRepository.findById(ocId)
    if (!oc) throw new HttpError(404, "Orden de compra no encontrada")
    if (!ESTADOS_EDITABLES.includes(oc.estado)) {
      throw new HttpError(422, `Una orden de compra en estado "${oc.estado}" no admite cambios`)
    }
    return oc
  }
}
