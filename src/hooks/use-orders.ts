"use client"

import { useState, useEffect } from "react"
import { OrdenCompra } from "@/models"
import { showSuccessToast, showErrorToast, toastMessages } from "@/shared/toast-helpers"
import { api } from "@/shared/api-client"

export function useOrders() {
  const [orders, setOrders] = useState<OrdenCompra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const data = await api("/api/ordenes-compra")
      setOrders(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  // Transición de estado: ruta propia, gateada por rol y por los triggers de la DB.
  // Un 422 trae el mensaje del trigger en español (p.ej. la OC sin líneas).
  const cambiarEstadoOrden = async (id: string | number, estado: string) => {
    try {
      const updatedOrder = await api(`/api/ordenes-compra/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      })
      setOrders(prev => prev.map(order => order.id === Number(id) ? updatedOrder : order))

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

  useEffect(() => {
    fetchOrders()
  }, [])

  return {
    orders,
    loading,
    error,
    cambiarEstadoOrden,
  }
}
