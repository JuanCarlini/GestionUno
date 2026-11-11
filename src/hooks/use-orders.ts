"use client"

import { OrdenCompra } from "@/models"
import { showSuccessToast, showErrorToast, toastMessages } from "@/shared/toast-helpers"
import { api } from "@/shared/api-client"
import { useListado } from "./use-listado"

// Listado paginado de OC + la transición de estado. El estado del listado (página, filtros,
// orden, sincronía con la URL) vive en useListado; acá queda lo del dominio.
export function useOrders() {
  const listado = useListado<OrdenCompra>("/api/ordenes-compra", {
    ordenInicial: "created_at.desc",
  })

  // Transición de estado: ruta propia, gateada por rol y por los triggers de la DB.
  // Un 422 trae el mensaje del trigger en español (p.ej. la OC sin líneas).
  const cambiarEstadoOrden = async (id: string | number, estado: string) => {
    try {
      const updatedOrder = await api(`/api/ordenes-compra/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      })
      // Se reemplaza la fila en memoria en vez de re-pedir la página: el usuario no pierde
      // la posición ni ve parpadear la tabla.
      listado.setItems((prev) =>
        prev.map((order) => (order.id === Number(id) ? updatedOrder : order))
      )

      const mensaje =
        estado === "aprobado" ? toastMessages.ordenCompra.approved
        : estado === "anulado" || estado === "rechazado" ? toastMessages.ordenCompra.rejected
        : toastMessages.ordenCompra.updated
      showSuccessToast(mensaje, `Orden #${updatedOrder.numero_oc}`)
      return updatedOrder
    } catch (err) {
      showErrorToast(toastMessages.ordenCompra.error, err instanceof Error ? err.message : "Error desconocido")
      throw err
    }
  }

  return { ...listado, orders: listado.items, cambiarEstadoOrden }
}
