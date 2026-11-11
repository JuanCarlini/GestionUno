import { OrdenPagoRepository } from "@/repositories/orden-pago.repository"
import { HttpError } from "@/lib/route/http-error"
import { exigirCambioAplicado } from "@/lib/route/estado-route"
import { puedeTransicionar, TRANSICIONES_OP } from "@/services/transiciones"
import type { Orden, Pagina, Paginacion } from "@/lib/route/paginacion"
import type { FiltrosListado } from "@/repositories/filtros"
import type {
  CreateOrdenPagoData,
  CreateLineaFactura,
  CreateLineaCaja,
  EstadoOp,
  OrdenPago,
} from "@/models"

// Reglas de negocio de órdenes de pago (I/O en OrdenPagoRepository). La app mantiene
// total_a_pagar = Σ facturas; el gate de pago (moneda y Σcajas = Σfacturas) es fn_op_gate.
export class OrdenPagoService {
  static async getPagina(
    p: Paginacion,
    opts: { filtros?: FiltrosListado; orden?: Orden } = {}
  ): Promise<Pagina<Record<string, unknown>>> {
    const { data, total } = await OrdenPagoRepository.findPaginaWithProveedor(p, opts)
    return {
      total,
      data: data.map((op: any) => ({ ...op, proveedor_nombre: op.gu_proveedores?.nombre })),
    }
  }

  static async getById(id: number) {
    const op = await OrdenPagoRepository.findByIdWithProveedor(id)
    if (!op) return null

    const [facturas, cajas] = await Promise.all([
      OrdenPagoRepository.findLineasFactura(id),
      OrdenPagoRepository.findLineasCaja(id),
    ])

    return {
      ...op,
      proveedor_nombre: op.gu_proveedores?.nombre,
      proveedor_cuit: op.gu_proveedores?.cuit,
      facturas,
      cajas,
    }
  }

  // numero_op lo genera la DB; estado nace en 'borrador'; total arranca en 0 y lo
  // sube agregarFactura.
  static async create(payload: CreateOrdenPagoData): Promise<OrdenPago> {
    return OrdenPagoRepository.insert({ ...payload, estado: "borrador", total_a_pagar: 0 })
  }

  // Agrega una factura a pagar. fn_lop_factura_pagable valida que sea finalizada y del mismo
  // proveedor/moneda; si rebota, sube como P0001 -> 422. total_a_pagar = Σ de las líneas, y lo
  // mantiene trg_recalc_op_total en la misma transacción.
  static async agregarFactura(opId: number, input: CreateLineaFactura) {
    await OrdenPagoService.getEditable(opId)
    return OrdenPagoRepository.insertLineaFactura({
      orden_pago_id: opId,
      factura_id: input.factura_id,
      monto: input.monto,
    })
  }

  static async quitarFactura(opId: number, facturaId: number): Promise<boolean> {
    await OrdenPagoService.getEditable(opId)
    return OrdenPagoRepository.deleteLineaFactura(opId, facturaId)
  }

  // Reparte el pago en una caja. NO se valida la moneda ni la suma acá: eso lo hace
  // fn_op_gate al mandar a aprobar. Duplicarlo en JS sería mentir sobre dónde vive la regla.
  static async agregarCaja(opId: number, input: CreateLineaCaja) {
    await OrdenPagoService.getEditable(opId)
    return OrdenPagoRepository.insertLineaCaja({
      orden_pago_id: opId,
      caja_id: input.caja_id,
      monto: input.monto,
    })
  }

  static async quitarCaja(opId: number, cajaId: number): Promise<boolean> {
    await OrdenPagoService.getEditable(opId)
    return OrdenPagoRepository.deleteLineaCaja(opId, cajaId)
  }

  // total_a_pagar = Σ monto de las líneas de factura (lo que hay que pagar). Lo calcula
  // trg_recalc_op_total sobre gu_lineasdeordenesdepago, dentro de la misma transacción que
  // agregó o quitó la línea (ver la migración totales_01_triggers_cabecera).

  // Pre-chequeo del grafo (409). El gate de negocio (Σ, moneda) es fn_op_gate y devuelve 422.
  static async cambiarEstado(id: number, destino: EstadoOp): Promise<OrdenPago> {
    const op = await OrdenPagoRepository.findById(id)
    if (!op) throw new HttpError(404, "Orden de pago no encontrada")

    if (!puedeTransicionar(TRANSICIONES_OP, op.estado, destino)) {
      throw new HttpError(409, `No se puede pasar de ${op.estado} a ${destino}`)
    }

    // El estado leído arriba viaja al update: si cambió en el medio, 409.
    return exigirCambioAplicado(await OrdenPagoRepository.updateEstado(id, destino, op.estado))
  }

  // Solo se borra un borrador o una rechazada: una OP pagada es el registro del pago y
  // borrarla lo haría desaparecer de reportes y rollups (la baja con rastro es anular).
  static async delete(id: number): Promise<boolean> {
    const op = await OrdenPagoRepository.findById(id)
    if (!op) throw new HttpError(404, "Orden de pago no encontrada")
    if (op.estado !== "borrador" && op.estado !== "rechazado") {
      throw new HttpError(422, `No se puede eliminar una orden de pago en estado "${op.estado}": anulala en su lugar`)
    }
    return OrdenPagoRepository.delete(id)
  }

  // Las líneas (facturas y cajas) solo se tocan mientras la OP es un borrador (o rechazada):
  // una vez en aprobación, fn_op_gate ya validó las sumas y cambiarlas las invalidaría.
  private static async getEditable(opId: number): Promise<OrdenPago> {
    const op = await OrdenPagoRepository.findById(opId)
    if (!op) throw new HttpError(404, "Orden de pago no encontrada")
    if (op.estado !== "borrador" && op.estado !== "rechazado") {
      throw new HttpError(422, `No se pueden modificar las líneas de una orden de pago en estado "${op.estado}"`)
    }
    return op
  }
}
