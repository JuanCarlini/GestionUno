// Catálogo de permisos RBAC: fuente de verdad en código, no en la DB (evita drift). Solo
// enumera qué claves `modulo:accion` son legítimas y sus etiquetas para la matriz de la UI.

export type Accion = "ver" | "crear" | "aprobar" | "borrar"

export const ACCION_LABEL: Record<Accion, string> = {
  ver: "Ver",
  crear: "Crear / Editar",
  aprobar: "Aprobar / Anular",
  borrar: "Borrar",
}

// Módulo → etiqueta + acciones válidas. Los 4 módulos de workflow tienen las 4 acciones;
// proveedores, items y proyectos solo ver/crear (no tienen aprobación ni borrado). = 22 pares.
export const PERMISOS_CATALOGO = {
  ordenes_compra: { label: "Órdenes de compra", acciones: ["ver", "crear", "aprobar", "borrar"] },
  certificaciones: { label: "Certificaciones", acciones: ["ver", "crear", "aprobar", "borrar"] },
  facturas: { label: "Facturas", acciones: ["ver", "crear", "aprobar", "borrar"] },
  ordenes_pago: { label: "Órdenes de pago", acciones: ["ver", "crear", "aprobar", "borrar"] },
  proveedores: { label: "Proveedores", acciones: ["ver", "crear"] },
  items: { label: "Ítems", acciones: ["ver", "crear"] },
  proyectos: { label: "Proyectos", acciones: ["ver", "crear"] },
} as const satisfies Record<string, { label: string; acciones: Accion[] }>

// Las 22 claves `modulo:accion` válidas, en Set para chequeo O(1).
export const PERMISOS_VALIDOS: Set<string> = new Set(
  Object.entries(PERMISOS_CATALOGO).flatMap(([modulo, def]) =>
    def.acciones.map((accion) => `${modulo}:${accion}`)
  )
)

// ¿La clave `modulo:accion` es un permiso legítimo del catálogo?
export function esPermisoValido(clave: string): boolean {
  return PERMISOS_VALIDOS.has(clave)
}
