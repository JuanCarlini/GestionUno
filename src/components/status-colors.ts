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

// El texto va sobre el tinte /10 de su propio color, no sobre la card limpia, así que el
// contraste hay que medirlo contra la mezcla. Medido: en claro, emerald-600 daba 2.72:1 y
// amber-600 3.43:1 —los dos abajo del 4.5:1 de AA, y encima se usan en text-xs, que es el
// caso más exigente—; el paso a 700 los deja en 4.99 y 4.65. En oscuro pasaba al revés: el
// verde y el ámbar en 400 iban holgados (7.87 y 8.90) y el que fallaba era el rojo, con
// text-destructive en 3.37:1, que sube a 5.90 con red-400.
//
// Los 400 de oscuro y los 700 de claro no son simétricos porque el fondo no lo es: sobre
// blanco hay que bajar la luminosidad del texto y sobre negro hay que subirla.
function getStatusColor(estado: string | null | undefined): string {
  const category = getStatusCategory(estado)

  switch (category) {
    case StatusCategory.SUCCESS:
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
    case StatusCategory.PENDING:
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
    case StatusCategory.ERROR:
      return "bg-destructive/10 text-destructive dark:text-red-400 border-destructive/20"
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
    // Mismos valores que el texto del chip: el ícono y la etiqueta comparten color.
    case StatusCategory.SUCCESS:
      return "text-emerald-700 dark:text-emerald-400"
    case StatusCategory.PENDING:
      return "text-amber-700 dark:text-amber-400"
    case StatusCategory.ERROR:
      return "text-destructive dark:text-red-400"
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
