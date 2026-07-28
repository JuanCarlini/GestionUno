import { FacturaService } from "@/services/factura.service"
import { CambiarEstadoFacturaSchema } from "@/shared/validation/factura-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { accionRequerida } from "@/services/transiciones"
import { estadoRoute } from "@/lib/route/estado-route"
import type { AccionAuditoria } from "@/lib/audit/audit.service"
import type { EstadoFactura } from "@/models"

const ACCION: Record<EstadoFactura, AccionAuditoria> = {
  finalizado: "actualizar",
  anulado: "anular",
  borrador: "actualizar",
}

// PATCH transición de estado de la factura (sin aprobación intermedia). El permiso depende del
// destino: finalizar -> 'facturas:crear', anular -> 'facturas:aprobar'.
export const PATCH = estadoRoute({
  schema: CambiarEstadoFacturaSchema,
  autorizar: (estado: EstadoFactura) => requirePermission("facturas", accionRequerida(estado)),
  cambiarEstado: (id, estado) => FacturaService.cambiarEstado(id, estado),
  tabla: "gu_facturas",
  accion: (estado) => ACCION[estado],
  detalle: (factura, estado) => `Factura ${factura.numero_factura}: ${estado}`,
  contexto: "PATCH /api/facturas/[id]/estado",
})
