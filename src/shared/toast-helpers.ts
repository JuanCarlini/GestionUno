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

// Toast messages específicos para acciones comunes
export const toastMessages = {
  // Órdenes de Compra
  ordenCompra: {
    created: "Orden de compra creada exitosamente",
    updated: "Orden de compra actualizada",
    deleted: "Orden de compra eliminada",
    approved: "Orden de compra aprobada",
    rejected: "Orden de compra rechazada",
    error: "Error al procesar la orden de compra"
  },
  
  // Órdenes de Pago
  ordenPago: {
    created: "Orden de pago creada exitosamente",
    updated: "Orden de pago actualizada",
    deleted: "Orden de pago eliminada",
    approved: "Orden de pago aprobada",
    rejected: "Orden de pago rechazada",
    paid: "Orden de pago marcada como pagada",
    error: "Error al procesar la orden de pago"
  },
  
  // Proveedores
  proveedor: {
    created: "Proveedor registrado exitosamente",
    updated: "Información del proveedor actualizada",
    deleted: "Proveedor eliminado",
    activated: "Proveedor activado",
    deactivated: "Proveedor desactivado",
    error: "Error al procesar el proveedor"
  },
  
  // General
  general: {
    loading: "Procesando...",
    networkError: "Error de conexión",
    unknownError: "Ha ocurrido un error inesperado"
  }
}
