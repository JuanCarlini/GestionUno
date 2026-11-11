"use client"

import { OrdenPago } from "@/models"
import { showSuccessToast, showErrorToast, toastMessages } from "@/shared/toast-helpers"
import { api } from "@/shared/api-client"
import { useListado } from "./use-listado"

// Fila de OP enriquecida con el join de proveedor que hace OrdenPagoService.getPagina
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
  const listado = useListado<OrdenPagoRow>("/api/ordenes-pago", { ordenInicial: "created_at.desc" })

  // Cambio de estado genérico. El circuito no saltea etapas: borrador -> en_aprobacion
  // (aplica fn_op_gate) -> aprobado -> pagado. Un 422 trae el mensaje del gate.
  const cambiarEstado = async (id: string | number, estado: string) => {
    try {
      const updatedOrder = await patchEstado(id, estado)
      listado.setItems((prev) =>
        prev.map((order) => (order.id === Number(id) ? { ...order, ...updatedOrder } : order))
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

  return {
    ...listado,
    orders: listado.items,
    cambiarEstado,
    aprobarOrden: (id: string | number) => cambiarEstado(id, "aprobado"),
    pagarOrden: (id: string | number) => cambiarEstado(id, "pagado"),
    rechazarOrden: (id: string | number) => cambiarEstado(id, "rechazado"),
  }
}
