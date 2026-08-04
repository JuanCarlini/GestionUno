import { EstadoProveedor } from "@/models"
import { patchEstadoProveedor } from "../cambio-estado"

// PATCH /api/proveedores/[id]/suspender - "Suspender" se materializa como inactivo
// (el enum solo tiene activo/inactivo). Solo supervisor+.
export const PATCH = patchEstadoProveedor({
  estado: EstadoProveedor.INACTIVO,
  accion: "desactivar",
  detalle: (nombre) => `Proveedor ${nombre} desactivado (inactivo)`,
  contexto: "PATCH /api/proveedores/[id]/suspender",
})
