import { OrdenPagoService } from "@/services"
import { CambiarEstadoOPSchema } from "@/shared/validation/orden-pago-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { accionRequerida } from "@/services/transiciones"
import { estadoRoute } from "@/lib/route/estado-route"
import type { AccionAuditoria } from "@/lib/audit/audit.service"
import type { EstadoOp } from "@/models"

const ACCION: Record<EstadoOp, AccionAuditoria> = {
  aprobado: "aprobar",
  rechazado: "rechazar",
  anulado: "anular",
  pagado: "actualizar",
  en_aprobacion: "actualizar",
  borrador: "actualizar",
}

// PATCH transición de estado de la OP. El permiso depende del destino: pagar/aprobar/rechazar/anular
// exigen supervisor+, mandar a aprobar solo escritura. El gate del trigger (fn_op_gate) devuelve 422.
export const PATCH = estadoRoute({
  schema: CambiarEstadoOPSchema,
  autorizar: (estado: EstadoOp) => requirePermission("ordenes_pago", accionRequerida(estado)),
  cambiarEstado: (id, estado) => OrdenPagoService.cambiarEstado(id, estado),
  tabla: "gu_ordenesdepago",
  accion: (estado) => ACCION[estado],
  detalle: (orden, estado) => `Orden de pago ${orden.numero_op}: ${estado}`,
  contexto: "PATCH /api/ordenes-pago/[id]/estado",
})
