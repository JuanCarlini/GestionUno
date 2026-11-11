"use client"

import { Proveedor } from "@/models"
import { showSuccessToast, showErrorToast, toastMessages } from "@/shared/toast-helpers"
import { api } from "@/shared/api-client"
import { useListado } from "./use-listado"

// Listado paginado de proveedores + el cambio de estado. El estado del listado (página,
// filtros, orden, sincronía con la URL) vive en useListado.
export function useProveedores() {
  const listado = useListado<Proveedor>("/api/proveedores", { ordenInicial: "nombre.asc" })

  // Un solo camino para los dos sentidos: la ruta es PATCH /estado con { activo }.
  const cambiarActivo = async (id: number, activo: boolean) => {
    try {
      const updatedProveedor = await api(`/api/proveedores/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo }),
      })
      if (updatedProveedor) {
        listado.setItems((prev) => prev.map((p) => (p.id === id ? updatedProveedor : p)))
        showSuccessToast(
          activo ? toastMessages.proveedor.activated : toastMessages.proveedor.deactivated,
          updatedProveedor.nombre
        )
      }
      return updatedProveedor
    } catch (err) {
      showErrorToast(toastMessages.proveedor.error, err instanceof Error ? err.message : "Error desconocido")
      throw err
    }
  }

  return {
    ...listado,
    proveedores: listado.items,
    activarProveedor: (id: number) => cambiarActivo(id, true),
    // La DB solo tiene activo/inactivo: "suspender" se materializa como inactivo.
    suspenderProveedor: (id: number) => cambiarActivo(id, false),
  }
}
