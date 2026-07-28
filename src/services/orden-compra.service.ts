import type { TablesUpdate } from "@/lib/supabase/database.types"
import { OrdenCompraRepository } from "@/repositories/orden-compra.repository"
import { ItemPrecioRepository } from "@/repositories/item-precio.repository"
import { HttpError } from "@/lib/route/http-error"
import { totalesDeLinea, totalesDeCabecera, IVA_DEFAULT } from "@/services/totales"
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

// Una OC solo acepta cambios en sus líneas mientras es borrador (o rechazada): editar cantidades
// tras aprobarla falsearía el avance certificado y dejaría v_loc_rollup en negativo.
const ESTADOS_EDITABLES: EstadoAprobacion[] = ["borrador", "rechazado"]

// Reglas de negocio de órdenes de compra (I/O en OrdenCompraRepository). Numeración, gate de
// ≥1 línea y rollups (v_oc_rollup / v_loc_rollup) viven en la DB.
export class OrdenCompraService {
  // Lista con el chip de estado de certificación, leído de la vista.
  static async getAll() {
    const ordenes = await OrdenCompraRepository.findAll()
    if (ordenes.length === 0) return []

    const rollups = await OrdenCompraRepository.findRollupsByIds(ordenes.map((o) => o.id))
    const porId = new Map(rollups.map((r) => [r.orden_compra_id, r]))

    return ordenes.map((oc) => ({
      ...oc,
      estado_certificacion: porId.get(oc.id)?.estado_certificacion ?? "sin",
      monto_pendiente_certificar: Number(porId.get(oc.id)?.monto_pendiente_certificar ?? 0),
    }))
  }

  static async getById(id: number): Promise<OrdenCompra | null> {
    return OrdenCompraRepository.findById(id)
  }

  // Crea la OC (cabecera + líneas opcionales). numero_oc lo genera la DB; el estado lo
  // fija el server; los totales los calcula la app (la DB no los mantiene).
  static async create(
    payload: CreateOrdenCompraData & { lineas?: CreateLineaFromItem[] }
  ): Promise<OrdenCompra> {
    const { lineas, ...ocData } = payload

    const oc = await OrdenCompraRepository.insert({ ...ocData, estado: "borrador" })

    if (lineas && lineas.length > 0) {
      try {
        // Concurrente (I/O-bound): cada armarLinea hace su lookup de item + precio; en serie
        // eran ~2N round-trips secuenciales (N = líneas). Promise.all preserva el orden.
        const armadas = await Promise.all(lineas.map((l) => OrdenCompraService.armarLinea(oc, l)))
        await OrdenCompraRepository.insertLineas(armadas)
        await OrdenCompraService.recalcularCabecera(oc.id)
      } catch (e) {
        // Sin transacción de cliente: compensamos para no dejar una OC huérfana.
        await OrdenCompraRepository.deleteById(oc.id)
        throw e
      }
    }

    return oc
  }

  // Agrega una línea eligiendo un item del catálogo.
  static async addLinea(
    ocId: number,
    input: CreateLineaFromItem,
    opts = { recalcular: true }
  ): Promise<OrdenCompraLinea> {
    const oc = await OrdenCompraService.getEditable(ocId)
    const linea = await OrdenCompraService.armarLinea(oc, input)
    const creada = await OrdenCompraRepository.insertLinea(linea)

    if (opts.recalcular) await OrdenCompraService.recalcularCabecera(ocId)
    return creada
  }

  // Alias histórico: la ruta POST /[id]/lineas lo llama así.
  static async createLineFromItem(ocId: number, input: CreateLineaFromItem) {
    return OrdenCompraService.addLinea(ocId, input)
  }

  /**
   * El precio vive en gu_item_proveedor_precio (por proveedor), no en el item: si la UI no lo
   * manda se hereda del par (item, proveedor); si lo manda se guarda ahí y arma la lista.
   */
  private static async armarLinea(
    oc: Pick<OrdenCompra, "id" | "proveedor_id">,
    input: CreateLineaFromItem
  ): Promise<CreateOrdenCompraLinea> {
    const item = await ItemService.getById(input.item_id)
    if (!item) throw new HttpError(404, `Item con ID ${input.item_id} no encontrado`)

    let precio = input.precio_unitario_neto
    if (precio === undefined) {
      const heredado = await ItemPrecioRepository.findPrecio(input.item_id, oc.proveedor_id)
      if (heredado === null) {
        throw new HttpError(
          422,
          `El item ${item.codigo} no tiene precio cargado para este proveedor: indicá un precio unitario`
        )
      }
      precio = heredado
    } else {
      await ItemPrecioRepository.upsertPrecio(input.item_id, oc.proveedor_id, precio)
    }

    const iva = input.iva_porcentaje ?? IVA_DEFAULT
    return {
      orden_compra_id: oc.id,
      item_id: item.id,
      descripcion: input.descripcion || item.nombre,
      cantidad: input.cantidad,
      unidad_medida: item.unidad_medida,
      precio_unitario_neto: precio,
      iva_porcentaje: iva,
      ...totalesDeLinea(input.cantidad, precio, iva),
    }
  }

  // Actualizar una línea; si cambia cantidad/precio/IVA, recalcula sus totales y los de la cabecera.
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

    const actualizada = await OrdenCompraRepository.updateLinea(lineaId, updates)
    await OrdenCompraService.recalcularCabecera(actual.orden_compra_id)
    return actualizada
  }

  static async deleteLine(lineaId: number): Promise<boolean> {
    const actual = await OrdenCompraRepository.findLineaById(lineaId)
    if (!actual) throw new HttpError(404, "Línea no encontrada")
    await OrdenCompraService.getEditable(actual.orden_compra_id)

    const ok = await OrdenCompraRepository.deleteLinea(lineaId)
    if (ok) await OrdenCompraService.recalcularCabecera(actual.orden_compra_id)
    return ok
  }

  // La DB no mantiene los totales de cabecera: tras tocar líneas, la app los reescribe.
  static async recalcularCabecera(ocId: number): Promise<void> {
    const lineas = await OrdenCompraRepository.findLineasByOrdenId(ocId)
    await OrdenCompraRepository.update(ocId, totalesDeCabecera(lineas))
  }

  // Pre-chequeo del grafo de estados (409). Los gates de negocio son triggers y devuelven 422:
  // acá no se reimplementan.
  static async cambiarEstado(id: number, destino: EstadoAprobacion): Promise<OrdenCompra> {
    const oc = await OrdenCompraRepository.findById(id)
    if (!oc) throw new HttpError(404, "Orden de compra no encontrada")

    if (!puedeTransicionar(TRANSICIONES_APROBACION, oc.estado, destino)) {
      throw new HttpError(409, `No se puede pasar de ${oc.estado} a ${destino}`)
    }

    return OrdenCompraRepository.updateEstado(id, destino)
  }

  // La cabecera se protege como las líneas: sin esta guarda se podría reasignar el proveedor o la
  // moneda de una OC ya aprobada, y acá la app es el único control (la DB no lo cubre).
  static async update(id: number, payload: TablesUpdate<"gu_ordenesdecompra">): Promise<OrdenCompra | null> {
    await OrdenCompraService.getEditable(id)
    return OrdenCompraRepository.update(id, payload)
  }

  static async delete(id: number): Promise<boolean> {
    await OrdenCompraService.getEditable(id)
    return OrdenCompraRepository.deleteById(id)
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
