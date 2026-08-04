import { FacturaRepository } from "@/repositories/factura.repository"
import { CertificacionRepository } from "@/repositories/certificacion.repository"
import { HttpError } from "@/lib/route/http-error"
import { totalesDeLinea, totalesDeCabecera, IVA_DEFAULT } from "@/services/totales"
import { puedeTransicionar, TRANSICIONES_FACTURA } from "@/services/transiciones"
import type { CreateFacturaData, CreateFacturaLinea, CreateImputacion, EstadoFactura } from "@/models"

interface CreateFacturaInput extends CreateFacturaData {
  lineas: CreateFacturaLinea[]
  imputaciones?: CreateImputacion[]
}

// Reglas de negocio de facturas (I/O en FacturaRepository). Numeración, regla de imputación y
// estado de pago viven en la DB; la app calcula los totales de línea, cabecera y facturado.
export class FacturaService {
  static async getAll() {
    const facturas = await FacturaRepository.findAllWithProveedor()
    if (facturas.length === 0) return []

    const rollups = await FacturaRepository.findRollupsByIds(facturas.map((f: any) => f.id))
    const porId = new Map(rollups.map((r) => [r.factura_id, r]))

    return facturas.map((factura: any) => ({
      ...factura,
      proveedor_nombre: factura.gu_proveedores?.nombre,
      proveedor_cuit: factura.gu_proveedores?.cuit,
      estado_pago: porId.get(factura.id)?.estado_pago ?? "sin",
      monto_pagado: Number(porId.get(factura.id)?.monto_pagado ?? 0),
    }))
  }

  static async getById(id: number) {
    const factura = await FacturaRepository.findByIdWithProveedor(id)
    if (!factura) return null

    const [lineas, imputaciones, rollups] = await Promise.all([
      FacturaRepository.findLineasByFacturaId(id),
      FacturaRepository.findImputaciones(id),
      FacturaRepository.findRollupsByIds([id]),
    ])

    return {
      ...factura,
      proveedor_nombre: factura.gu_proveedores?.nombre,
      proveedor_cuit: factura.gu_proveedores?.cuit,
      proveedor_email: factura.gu_proveedores?.email,
      proveedor_direccion: factura.gu_proveedores?.direccion,
      lineas,
      imputaciones,
      estado_pago: rollups[0]?.estado_pago ?? "sin",
      monto_pagado: Number(rollups[0]?.monto_pagado ?? 0),
    }
  }

  /**
   * Certificaciones imputables del proveedor: aprobadas y con saldo facturable > 0
   * (total_con_iva − monto_facturado, leído de v_cert_rollup). El shape es el que
   * consume el formulario de factura; el filtro vive acá, no en el cliente.
   */
  static async getCertificacionesAprobadas(proveedorId: number) {
    const certs = await FacturaRepository.findCertificacionesAprobadas(proveedorId)
    if (certs.length === 0) return []

    const rollups = await CertificacionRepository.findRollupsByIds(certs.map((c: any) => c.id))
    const porId = new Map(rollups.map((r) => [r.certificacion_id, r]))

    return certs
      .map((c: any) => {
        const total = Number(c.total_con_iva ?? 0)
        const facturado = Number(porId.get(c.id)?.monto_facturado ?? 0)
        return {
          id: c.id,
          numero_cert: c.numero_cert,
          moneda: c.gu_ordenesdecompra?.moneda ?? null,
          total_con_iva: total,
          saldo_facturable: total - facturado,
        }
      })
      .filter((c) => c.saldo_facturable > 0.01)
  }

  /**
   * Crea la factura: las líneas van antes que las imputaciones porque fn_check_imputacion compara
   * la suma imputada contra Σtotal_con_iva de las LFACT.
   */
  static async create(payload: CreateFacturaInput) {
    const { lineas, imputaciones, ...facturaData } = payload

    if (!lineas || lineas.length === 0) {
      throw new HttpError(422, "La factura debe tener al menos una línea")
    }

    const nuevaFactura = await FacturaRepository.insert({ ...facturaData, estado: "borrador" })

    try {
      await FacturaRepository.insertLineas(lineas.map((l) => FacturaService.armarLinea(nuevaFactura.id, l)))
      await FacturaService.recalcularCabecera(nuevaFactura.id)

      if (imputaciones && imputaciones.length > 0) {
        await FacturaRepository.insertImputaciones(
          imputaciones.map((i) => ({
            factura_id: nuevaFactura.id,
            certificacion_id: i.certificacion_id,
            monto_asignado: i.monto_asignado,
          }))
        )
      }
    } catch (e) {
      // Sin transacción de cliente: compensamos para no dejar una factura huérfana.
      await FacturaRepository.deleteById(nuevaFactura.id)
      throw e
    }

    return nuevaFactura
  }

  // Los totales de la línea los calcula la app (la columna de precio es `precio_unitario`).
  private static armarLinea(facturaId: number, l: CreateFacturaLinea): CreateFacturaLinea & { factura_id: number } {
    const iva = l.iva_porcentaje ?? IVA_DEFAULT
    const { total_neto, total_con_iva } = totalesDeLinea(l.cantidad ?? 0, l.precio_unitario ?? 0, iva)
    return {
      factura_id: facturaId,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      iva_porcentaje: iva,
      total_neto,
      total_con_iva,
    }
  }

  // total_facturado = total_con_iva de las líneas: es lo que hay que pagar.
  static async recalcularCabecera(facturaId: number): Promise<void> {
    const lineas = await FacturaRepository.findLineasByFacturaId(facturaId)
    const totales = totalesDeCabecera(lineas)
    await FacturaRepository.update(facturaId, { ...totales, total_facturado: totales.total_con_iva })
  }

  // Imputar / desimputar: solo sobre una factura en borrador. El tope lo aplica el trigger.
  static async imputar(facturaId: number, imputaciones: CreateImputacion[]) {
    await FacturaService.getEditable(facturaId)
    await FacturaRepository.insertImputaciones(
      imputaciones.map((i) => ({
        factura_id: facturaId,
        certificacion_id: i.certificacion_id,
        monto_asignado: i.monto_asignado,
      }))
    )
  }

  static async desimputar(facturaId: number, certificacionId: number): Promise<boolean> {
    await FacturaService.getEditable(facturaId)
    return FacturaRepository.deleteImputacion(facturaId, certificacionId)
  }

  /**
   * Pre-chequeo del grafo (409). Finalizar exige ≥1 imputación y esta es la única barrera:
   * no hay trigger que lo garantice.
   */
  static async cambiarEstado(id: number, destino: EstadoFactura) {
    const factura = await FacturaRepository.findById(id)
    if (!factura) throw new HttpError(404, "Factura no encontrada")

    if (!puedeTransicionar(TRANSICIONES_FACTURA, factura.estado, destino)) {
      throw new HttpError(409, `No se puede pasar de ${factura.estado} a ${destino}`)
    }

    if (destino === "finalizado") {
      const imputaciones = await FacturaRepository.findImputaciones(id)
      if (imputaciones.length === 0) {
        throw new HttpError(422, "No se puede finalizar una factura sin certificaciones imputadas")
      }
    }

    return FacturaRepository.updateEstado(id, destino)
  }

  // Solo se borra un borrador: una factura finalizada o anulada es historia contable y se
  // preserva (la baja con rastro es la anulación, no el DELETE).
  static async delete(id: number) {
    const factura = await FacturaRepository.findById(id)
    if (!factura) throw new HttpError(404, "Factura no encontrada")
    if (factura.estado !== "borrador") {
      throw new HttpError(422, `No se puede eliminar una factura en estado "${factura.estado}": anulala en su lugar`)
    }
    return FacturaRepository.deleteById(id)
  }

  private static async getEditable(facturaId: number) {
    const factura = await FacturaRepository.findById(facturaId)
    if (!factura) throw new HttpError(404, "Factura no encontrada")
    if (factura.estado !== "borrador") {
      throw new HttpError(422, `No se pueden modificar las imputaciones de una factura en estado "${factura.estado}"`)
    }
    return factura
  }
}
