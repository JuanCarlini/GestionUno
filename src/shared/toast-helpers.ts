import { toast } from "sonner"

export const showSuccessToast = (message: string, description?: string) => {
  toast.success(message, {
    description,
    duration: 4000,
  })
}

export const showErrorToast = (message: string, description?: string) => {
  toast.error(message, {
    description,
    duration: 5000, // Errores duran un poco más
  })
}

// Solo los mensajes con consumidores: las transiciones de estado de los hooks de lista
// y activar/suspender proveedores. Los de crear/editar/borrar murieron con las
// mutaciones sin uso de los hooks (los formularios manejan sus errores con el form).
export const toastMessages = {
  ordenCompra: {
    updated: "Orden de compra actualizada",
    approved: "Orden de compra aprobada",
    rejected: "Orden de compra rechazada",
    error: "Error al procesar la orden de compra"
  },
  ordenPago: {
    updated: "Orden de pago actualizada",
    approved: "Orden de pago aprobada",
    rejected: "Orden de pago rechazada",
    paid: "Orden de pago marcada como pagada",
    error: "Error al procesar la orden de pago"
  },
  proveedor: {
    activated: "Proveedor activado",
    deactivated: "Proveedor desactivado",
    error: "Error al procesar el proveedor"
  },
}
