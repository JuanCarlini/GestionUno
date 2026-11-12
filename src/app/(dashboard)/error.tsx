"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RotateCw, ChevronDown } from "lucide-react"
import { useAuth } from "@/components/auth-context"
import { isAdmin, stringToUserRole } from "@/shared/permissions"

// Error boundary de todo el dashboard. Lo que reemplaza: una excepción en cualquier pantalla
// rompía el árbol y dejaba la pantalla en blanco.
//
// Queda DENTRO del layout (sidebar y header siguen ahí), así que el usuario puede irse a otra
// sección sin recargar.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { user } = useAuth()
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    // Al log del servidor va igual por Next; esto es para la consola del browser, que es
    // donde mira quien está reproduciendo el problema.
    console.error("Error en el dashboard:", error)
  }, [error])

  // El detalle técnico solo para admin: a un usuario de compras un stack no le sirve, y el
  // mensaje de una excepción puede filtrar nombres de tablas o de constraints.
  const mostrarDetalle = user ? isAdmin(stringToUserRole(user.rol)) : false

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          <CardTitle>Algo salió mal</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          No pudimos cargar esta pantalla. Puede ser algo pasajero: probá de nuevo y, si sigue
          fallando, avisale a quien administra el sistema.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button onClick={reset}>
            <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
        </div>

        {mostrarDetalle && (
          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              aria-expanded={abierto}
              className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium"
            >
              Detalle técnico
              <ChevronDown
                className={`h-4 w-4 transition-transform motion-reduce:transition-none ${
                  abierto ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {abierto && (
              <pre className="overflow-x-auto border-t border-border px-4 py-3 text-xs text-muted-foreground">
                {error.message}
                {error.digest ? `\n\ndigest: ${error.digest}` : ""}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
