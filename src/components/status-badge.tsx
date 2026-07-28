import { Badge } from "@/components/ui/badge"
import { getStatusStyle } from "./status-colors"
import { LABEL_ESTADO } from "@/models/enums"

interface StatusBadgeProps {
  estado: string | null | undefined
  showIcon?: boolean
  className?: string
}

export function StatusBadge({ estado, showIcon = false, className = "" }: StatusBadgeProps) {
  const style = getStatusStyle(estado)
  const Icon = style.icon
  // Etiqueta legible desde enums.ts (la DB dice 'en_aprobacion', acá "Esperando aprobación").
  // Si el estado no está en el mapa, se muestra el crudo con capitalize como fallback.
  const conocido = estado ? LABEL_ESTADO[estado as keyof typeof LABEL_ESTADO] : undefined
  const label = conocido ?? estado ?? "Sin estado"

  return (
    <Badge className={`${style.color} ${className}`}>
      <div className="flex items-center space-x-1">
        {showIcon && <Icon className={`h-3.5 w-3.5 ${style.iconColor}`} />}
        <span className={conocido ? "" : "capitalize"}>{label}</span>
      </div>
    </Badge>
  )
}
