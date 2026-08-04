import { EstadoProveedor } from "@/models"
import { patchEstadoProveedor } from "../cambio-estado"

// PATCH /api/proveedores/[id]/activar - Reactivar un proveedor (solo supervisor+).
export const PATCH = patchEstadoProveedor({
  estado: EstadoProveedor.ACTIVO,
  accion: "activar",
  detalle: (nombre) => `Proveedor ${nombre} activado`,
  contexto: "PATCH /api/proveedores/[id]/activar",
})
