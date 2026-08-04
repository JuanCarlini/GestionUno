"use client"

import { useState, useEffect } from "react"
import { OrdenPago } from "@/models"
import { showSuccessToast, showErrorToast, toastMessages } from "@/shared/toast-helpers"
import { api } from "@/shared/api-client"

// Fila de OP enriquecida con el join de proveedor que hace OrdenPagoService.getAll
type OrdenPagoRow = OrdenPago & { proveedor_nombre?: string }

// Transición de estado: ruta propia (PATCH /estado), gateada por rol y por fn_op_gate.
function patchEstado(id: string | number, estado: string) {
  return api(`/api/ordenes-pago/${id}/estado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado }),
  })
}

export function useOrdenesPago() {
  const [orders, setOrders] = useState<OrdenPagoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const data = await api("/api/ordenes-pago")
      setOrders(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  // Cambio de estado genérico. El circuito no saltea etapas: borrador -> en_aprobacion
  // (aplica fn_op_gate) -> aprobado -> pagado. Un 422 trae el mensaje del gate.
  const cambiarEstado = async (id: string | number, estado: string) => {
    try {
      const updatedOrder = await patchEstado(id, estado)
      setOrders(prev =>
        prev.map(order => order.id === Number(id) ? { ...order, ...updatedOrder } : order)
      )
      const msg =
        estado === "aprobado" ? toastMessages.ordenPago.approved
        : estado === "pagado" ? toastMessages.ordenPago.paid
        : estado === "rechazado" ? toastMessages.ordenPago.rejected
        : toastMessages.ordenPago.updated
      showSuccessToast(msg, `Orden #${updatedOrder.numero_op}`)
      return updatedOrder
    } catch (err) {
      showErrorToast(toastMessages.ordenPago.error, err instanceof Error ? err.message : "Error desconocido")
      throw err
    }
  }

  const aprobarOrden = (id: string | number) => cambiarEstado(id, "aprobado")
  const pagarOrden = (id: string | number) => cambiarEstado(id, "pagado")
  const rechazarOrden = (id: string | number) => cambiarEstado(id, "rechazado")

  useEffect(() => {
    fetchOrders()
  }, [])

  return {
    orders,
    loading,
    error,
    cambiarEstado,
    aprobarOrden,
    pagarOrden,
    rechazarOrden,
  }
}
