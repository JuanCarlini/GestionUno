import { CertificacionService } from "@/services/certificacion.service"
import { CambiarEstadoCertificacionSchema } from "@/shared/validation/certificacion-validation"
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

// PATCH transición de estado de la certificación. El trigger (regla del 100%, OC no aprobada)
// devuelve 422.
export const PATCH = estadoRoute({
  schema: CambiarEstadoCertificacionSchema,
  autorizar: (estado: EstadoAprobacion) => requirePermission("certificaciones", accionRequerida(estado)),
  cambiarEstado: (id, estado) => CertificacionService.cambiarEstado(id, estado),
  tabla: "gu_certificaciones",
  accion: (estado) => ACCION[estado],
  detalle: (cert, estado) => `Certificación ${cert.numero_cert}: ${estado}`,
  contexto: "PATCH /api/certificaciones/[id]/estado",
})
