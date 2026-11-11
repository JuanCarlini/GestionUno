"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Paginador al pie de los listados. Con una sola página no se muestra: un paginador con dos
// flechas deshabilitadas es ruido.
export function Paginador({
  page,
  paginas,
  total,
  limit,
  refrescando,
  onIrA,
}: {
  page: number
  paginas: number
  total: number
  limit: number
  refrescando: boolean
  onIrA: (page: number) => void
}) {
  if (paginas <= 1) return null

  const desde = (page - 1) * limit + 1
  const hasta = Math.min(page * limit, total)

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row"
      aria-label="Paginación"
    >
      {/* aria-live: el lector de pantalla anuncia el cambio de página sin mover el foco. */}
      <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
        {desde}–{hasta} de {total}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onIrA(page - 1)}
          disabled={page <= 1 || refrescando}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">Anterior</span>
        </Button>

        <span className="text-sm tabular-nums" aria-current="page">
          {page} / {paginas}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onIrA(page + 1)}
          disabled={page >= paginas || refrescando}
          aria-label="Página siguiente"
        >
          <span className="mr-1 hidden sm:inline">Siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  )
}
