import type { ComponentType, ReactNode } from "react"

// Estado vacío de listas: ícono + mensaje y, cuando la lista está realmente vacía
// (no filtrada), una acción para crear el primer registro.
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/50" />
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}
