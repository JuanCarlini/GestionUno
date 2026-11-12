"use client"

import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ListSkeleton } from "@/components/skeletons"

// Estados uniformes de las listas del circuito (loading / error). El resto — título,
// buscador, filas, empty-state — diverge por dominio y va como children.
export function ListShell({
  loading,
  error,
  loadingText,
  children,
}: {
  loading: boolean
  error: string | null
  loadingText: string
  children: ReactNode
}) {
  if (loading) {
    // El mismo skeleton que muestra loading.tsx mientras resuelve el Server Component: así la
    // transición entre los dos no salta. Antes era uno genérico de 4 barras iguales.
    return <ListSkeleton etiqueta={loadingText} />
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}
