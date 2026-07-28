import type { EstadoAprobacion, EstadoFactura, EstadoOp } from "@/models/enums"

// El grafo de transiciones, NO el gate: las reglas de negocio son triggers en Postgres (422).
// Acá solo se rechaza lo estructuralmente imposible (409): saltear etapas, revivir un anulado.
type Grafo<E extends string> = Record<E, readonly E[]>

// OC y CE comparten estado_aprobacion y el mismo grafo.
export const TRANSICIONES_APROBACION: Grafo<EstadoAprobacion> = {
  borrador: ["en_aprobacion", "anulado"],
  en_aprobacion: ["aprobado", "rechazado", "anulado"],
  aprobado: ["anulado"],
  rechazado: ["borrador", "anulado"],
  anulado: [],
}

// FACT no tiene aprobación intermedia.
export const TRANSICIONES_FACTURA: Grafo<EstadoFactura> = {
  borrador: ["finalizado", "anulado"],
  finalizado: ["anulado"],
  anulado: [],
}

// 'pagado' existe SOLO acá, y es terminal.
export const TRANSICIONES_OP: Grafo<EstadoOp> = {
  borrador: ["en_aprobacion", "anulado"],
  en_aprobacion: ["aprobado", "rechazado", "anulado"],
  aprobado: ["pagado", "anulado"],
  pagado: [],
  rechazado: ["borrador", "anulado"],
  anulado: [],
}

export function puedeTransicionar<E extends string>(grafo: Grafo<E>, desde: E, hacia: E): boolean {
  return (grafo[desde] ?? []).includes(hacia)
}

const REQUIERE_APROBACION = new Set(["aprobado", "rechazado", "anulado", "pagado"])

// El permiso depende del DESTINO, no del documento (vocabulario RBAC modulo:accion):
// aprobar/rechazar/anular/pagar → 'aprobar'; mandar-a-aprobar/volver-a-borrador → 'crear'.
export function accionRequerida(destino: string): "aprobar" | "crear" {
  return REQUIERE_APROBACION.has(destino) ? "aprobar" : "crear"
}
