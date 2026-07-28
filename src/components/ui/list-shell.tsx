"use client"

import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

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
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">{loadingText}</span>
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
