import type { TablesUpdate } from "@/lib/supabase/database.types"
import { CertificacionRepository } from "@/repositories/certificacion.repository"
import { OrdenCompraRepository } from "@/repositories/orden-compra.repository"
import { HttpError } from "@/lib/route/http-error"
import { totalesDeCertificacion } from "@/services/totales"
import { puedeTransicionar, TRANSICIONES_APROBACION } from "@/services/transiciones"
import type { CreateCertificacionLinea, EstadoAprobacion } from "@/models"

interface CreateCertificacionInput {
  orden_compra_id: number
  fecha_devengado?: string | null
  observaciones?: string | null
  lineas: CreateCertificacionLinea[]
}

// Reglas de negocio de certificaciones (I/O en CertificacionRepository). Numeración, derivación
// de líneas, tope del 100% y rollups viven en la DB; los chequeos de acá son pre-validación.
export class CertificacionService {
  static async getAll() {
    const certs = await CertificacionRepository.findAllWithRelations()
    if (certs.length === 0) return []

    const rollups = await CertificacionRepository.findRollupsByIds(certs.map((c: any) => c.id))
    const porId = new Map(rollups.map((r) => [r.certificacion_id, r]))

    return certs.map((cert: any) => ({
      ...cert,
      proveedor_nombre: cert.gu_proveedores?.nombre,
      numero_oc: cert.gu_ordenesdecompra?.numero_oc,
      moneda: cert.gu_ordenesdecompra?.moneda,
      estado_facturacion: porId.get(cert.id)?.estado_facturacion ?? "sin",
      monto_facturado: Number(porId.get(cert.id)?.monto_facturado ?? 0),
    }))
  }

  static async getById(id: number) {
    const cert = await CertificacionRepository.findByIdWithRelations(id)
    if (!cert) return null

    const [lineas, rollups] = await Promise.all([
      CertificacionRepository.findLineasByCertId(id),
      CertificacionRepository.findRollupsByIds([id]),
    ])

    return {
      ...cert,
      proveedor_nombre: cert.gu_proveedores?.nombre,
      proveedor_cuit: cert.gu_proveedores?.cuit,
      proveedor_email: cert.gu_proveedores?.email,
      numero_oc: cert.gu_ordenesdecompra?.numero_oc,
      moneda: cert.gu_ordenesdecompra?.moneda,
      lineas,
      estado_facturacion: rollups[0]?.estado_facturacion ?? "sin",
      monto_facturado: Number(rollups[0]?.monto_facturado ?? 0),
    }
  }

  /**
   * Crea la certificación contra una OC aprobada: el proveedor lo hereda de la OC y el número lo
   * genera la DB. Las líneas solo llevan `avance_unidades`; el resto lo deriva fn_lce_derive.
   */
  static async create(payload: CreateCertificacionInput) {
    const { orden_compra_id, lineas, ...certData } = payload

    if (!lineas || lineas.length === 0) {
      throw new HttpError(422, "La certificación debe tener al menos una línea")
    }

    const oc = await OrdenCompraRepository.findById(orden_compra_id)
    if (!oc) throw new HttpError(404, "Orden de compra no encontrada")
    if (oc.estado !== "aprobado") {
      throw new HttpError(
        422,
        `Solo se puede certificar contra una orden de compra aprobada (la OC ${oc.numero_oc} está en estado "${oc.estado}")`
      )
    }

    const nuevaCert = await CertificacionRepository.insert({
      ...certData,
      orden_compra_id,
      proveedor_id: oc.proveedor_id,
      estado: "borrador",
    })

    try {
      await CertificacionRepository.insertLineas(
        lineas.map((l) => ({
          certificacion_id: nuevaCert.id,
          linea_oc_id: l.linea_oc_id,
          avance_unidades: l.avance_unidades,
        }))
      )
      await CertificacionService.recalcularCabecera(nuevaCert.id)
    } catch (e) {
      // Sin transacción de cliente: si el trigger del 100% rechaza una línea, la cabecera
      // quedaría huérfana. Se compensa y se propaga el error crudo (la ruta lo hace 422).
      await CertificacionRepository.deleteById(nuevaCert.id)
      throw e
    }

    return nuevaCert
  }

  // Los totales de la cabecera los suma la app, desde las líneas ya derivadas por el trigger.
  static async recalcularCabecera(certId: number): Promise<void> {
    const lineas = await CertificacionRepository.findLineasByCertId(certId)
    await CertificacionRepository.update(certId, totalesDeCertificacion(lineas))
  }

  // Pre-chequeo del grafo (409). Los gates de negocio son triggers y devuelven 422.
  static async cambiarEstado(id: number, destino: EstadoAprobacion) {
    const cert = await CertificacionRepository.findByIdWithRelations(id)
    if (!cert) throw new HttpError(404, "Certificación no encontrada")

    if (!puedeTransicionar(TRANSICIONES_APROBACION, cert.estado, destino)) {
      throw new HttpError(409, `No se puede pasar de ${cert.estado} a ${destino}`)
    }

    return CertificacionRepository.updateEstado(id, destino)
  }

  // El schema solo deja pasar fecha_devengado/observaciones (el devengado suele cargarse
  // después de aprobar, por eso no se exige borrador). Una anulada sí queda congelada.
  static async update(id: number, data: TablesUpdate<"gu_certificaciones">) {
    const cert = await CertificacionRepository.findByIdWithRelations(id)
    if (!cert) throw new HttpError(404, "Certificación no encontrada")
    if (cert.estado === "anulado") {
      throw new HttpError(422, "No se puede editar una certificación anulada")
    }
    return CertificacionRepository.update(id, data)
  }

  // Solo se borra un borrador o una rechazada: una cert aprobada es historia del circuito y
  // borrarla además liberaría el tope del 100% (fn_check_avance_100 solo cuenta líneas vivas).
  static async delete(id: number) {
    const cert = await CertificacionRepository.findByIdWithRelations(id)
    if (!cert) throw new HttpError(404, "Certificación no encontrada")
    if (cert.estado !== "borrador" && cert.estado !== "rechazado") {
      throw new HttpError(422, `No se puede eliminar una certificación en estado "${cert.estado}": anulala en su lugar`)
    }
    return CertificacionRepository.deleteById(id)
  }

  /**
   * Líneas certificables de una OC con su saldo. El avance no se recalcula en JS: lo publica
   * v_loc_rollup (solo certs aprobadas); alimenta el formulario y el tope lo aplica el trigger.
   */
  static async getLineasDisponibles(ordenCompraId: number) {
    const lineas = await CertificacionRepository.findLineasDisponibles(ordenCompraId)
    if (lineas.length === 0) return []

    const rollups = await CertificacionRepository.findLocRollups(ordenCompraId)
    const porLinea = new Map(rollups.map((r) => [r.linea_oc_id, r]))

    return lineas.map((l: any) => {
      const rollup = porLinea.get(l.id)
      return {
        id: l.id,
        numero_loc: l.numero_loc,
        descripcion: l.descripcion,
        unidad_medida: l.unidad_medida,
        cantidad: Number(l.cantidad),
        precio_unitario_neto: Number(l.precio_unitario_neto),
        iva_porcentaje: Number(l.iva_porcentaje),
        cantidad_certificada: Number(rollup?.unidades_certificadas ?? 0),
        cantidad_disponible: Number(rollup?.unidades_pendientes ?? l.cantidad),
        estado_certificacion: rollup?.estado_certificacion ?? "sin",
      }
    })
  }
}
