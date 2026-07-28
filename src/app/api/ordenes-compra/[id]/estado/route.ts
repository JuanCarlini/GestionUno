import { OrdenCompraService } from "@/services"
import { CambiarEstadoOCSchema } from "@/shared/validation/orden-compra-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { accionRequerida } from "@/services/transiciones"
import { estadoRoute } from "@/lib/route/estado-route"
import type { AccionAuditoria } from "@/lib/audit/audit.service"
import type { EstadoAprobacion } from "@/models"

const ACCION: Record<EstadoAprobacion, AccionAuditoria> = {
  aprobado: "aprobar",
  rechazado: "rechazar",
  anulado: "anular",
  en_aprobacion: "actualizar",
  borrador: "actualizar",
}

// PATCH transición de estado de la OC. El permiso depende del DESTINO: mandar a aprobar es
// 'crear'; aprobar/rechazar/anular, 'aprobar'.
export const PATCH = estadoRoute({
  schema: CambiarEstadoOCSchema,
  autorizar: (estado: EstadoAprobacion) =>
    requirePermission("ordenes_compra", accionRequerida(estado)),
  cambiarEstado: (id, estado) => OrdenCompraService.cambiarEstado(id, estado),
  tabla: "gu_ordenesdecompra",
  accion: (estado) => ACCION[estado],
  detalle: (oc, estado) => `Orden de compra ${oc.numero_oc}: ${estado}`,
  contexto: "PATCH /api/ordenes-compra/[id]/estado",
})
