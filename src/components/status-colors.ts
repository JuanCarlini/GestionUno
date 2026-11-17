// Semaforización de los estados del circuito (OC/CE/FACT/OP), consumida vía StatusBadge.
// Proyectos y roles de admin tienen sus propios mapas de color.

import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Activity
} from "lucide-react"

enum StatusCategory {
  SUCCESS = "success",    // Verde - Aprobado/Completado
  PENDING = "pending",    // Amarillo - Esperando a un tercero
  ERROR = "error",        // Rojo - Rechazado/Error/Anulado
  INFO = "info",         // Azul - Informativo/En curso
  DRAFT = "draft"        // Neutro - Documento propio sin enviar
}

const statusMap: Record<string, StatusCategory> = {
  // Estados aprobados/exitosos - VERDE
  "aprobado": StatusCategory.SUCCESS,
  "activo": StatusCategory.SUCCESS,
  "pagado": StatusCategory.SUCCESS,
  "finalizado": StatusCategory.SUCCESS,

  // Borrador es un documento propio todavía en edición: neutro, no amarillo,
  // para que no se confunda con los estados que esperan acción de un tercero.
  "borrador": StatusCategory.DRAFT,
  "planificado": StatusCategory.DRAFT,

  // Estados pendientes/en proceso - AMARILLO
  "pendiente": StatusCategory.PENDING,
  "en_aprobacion": StatusCategory.PENDING,

  // Estados en curso - AZUL
  "en_ejecucion": StatusCategory.INFO,

  // Estados rechazados/error - ROJO
  "rechazado": StatusCategory.ERROR,
  "anulado": StatusCategory.ERROR,
  "cancelado": StatusCategory.ERROR,
  "error": StatusCategory.ERROR,
  "inactivo": StatusCategory.ERROR,
}

function getStatusCategory(estado: string | null | undefined): StatusCategory {
  if (!estado) return StatusCategory.INFO
  const estadoLower = estado.toLowerCase()
  return statusMap[estadoLower] || StatusCategory.INFO
}

// El chip es siempre el mismo patrón: el tinte del estado al 10%, su borde al 20% y la
// tinta encima. Los cuatro tokens de cada estado están explicados en globals.css; acá
// alcanza con saber que `-tint` es el fondo y `-ink` el texto, y que cada uno ya trae el
// valor que corresponde al tema, así que no hace falta una variante dark: por clase.
function getStatusColor(estado: string | null | undefined): string {
  const category = getStatusCategory(estado)

  switch (category) {
    case StatusCategory.SUCCESS:
      return "bg-success-tint/10 text-success-ink border-success-tint/20"
    case StatusCategory.PENDING:
      return "bg-warning-tint/10 text-warning-ink border-warning-tint/20"
    case StatusCategory.ERROR:
      return "bg-destructive-tint/10 text-destructive-ink border-destructive-tint/20"
    case StatusCategory.INFO:
      return "bg-info-tint/10 text-info-ink border-info-tint/20"
    case StatusCategory.DRAFT:
      return "bg-muted text-muted-foreground border-border"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function getStatusIcon(estado: string | null | undefined) {
  const category = getStatusCategory(estado)

  switch (category) {
    case StatusCategory.SUCCESS:
      return CheckCircle
    case StatusCategory.PENDING:
      return Clock
    case StatusCategory.ERROR:
      return XCircle
    case StatusCategory.INFO:
      return Activity
    case StatusCategory.DRAFT:
      return FileText
    default:
      return FileText
  }
}

function getStatusIconColor(estado: string | null | undefined): string {
  const category = getStatusCategory(estado)

  switch (category) {
    // La misma tinta que la etiqueta del chip: el ícono y el texto comparten color.
    case StatusCategory.SUCCESS:
      return "text-success-ink"
    case StatusCategory.PENDING:
      return "text-warning-ink"
    case StatusCategory.ERROR:
      return "text-destructive-ink"
    case StatusCategory.INFO:
      return "text-info-ink"
    case StatusCategory.DRAFT:
      return "text-muted-foreground"
    default:
      return "text-muted-foreground"
  }
}

export function getStatusStyle(estado: string | null | undefined) {
  return {
    category: getStatusCategory(estado),
    color: getStatusColor(estado),
    icon: getStatusIcon(estado),
    iconColor: getStatusIconColor(estado),
  }
}
