"use client"

import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

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
    return (
      <Card>
        <CardContent className="space-y-3 py-6" role="status" aria-busy="true" aria-label={loadingText}>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
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
