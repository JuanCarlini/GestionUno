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

function getStatusColor(estado: string | null | undefined): string {
  const category = getStatusCategory(estado)

  switch (category) {
    case StatusCategory.SUCCESS:
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    case StatusCategory.PENDING:
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
    case StatusCategory.ERROR:
      return "bg-destructive/10 text-destructive border-destructive/20"
    case StatusCategory.INFO:
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
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
    case StatusCategory.SUCCESS:
      return "text-emerald-600 dark:text-emerald-400"
    case StatusCategory.PENDING:
      return "text-amber-600 dark:text-amber-400"
    case StatusCategory.ERROR:
      return "text-destructive"
    case StatusCategory.INFO:
      return "text-blue-600 dark:text-blue-400"
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
