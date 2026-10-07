"use client"

import { useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import { showErrorToast, showSuccessToast } from "@/shared/toast-helpers"

interface Props {
  facturaId: string
  puedeSubir: boolean
}

// PDF del comprobante (Supabase Storage). Si Storage no responde, la API devuelve 503 con un
// mensaje para el usuario: se muestra tal cual en el toast, la factura no cambia.
export function FacturaComprobante({ facturaId, puedeSubir }: Props) {
  const [cargando, setCargando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const verPdf = async () => {
    setCargando(true)
    try {
      const response = await fetch(`/api/facturas/${facturaId}/comprobante`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "No se pudo obtener el PDF")
      window.open(body.url, "_blank", "noopener")
    } catch (error) {
      showErrorToast("No se pudo abrir el PDF", error instanceof Error ? error.message : undefined)
    } finally {
      setCargando(false)
    }
  }

  const subirPdf = async (archivo: File) => {
    setCargando(true)
    try {
      const formData = new FormData()
      formData.append("archivo", archivo)
      const response = await fetch(`/api/facturas/${facturaId}/comprobante`, {
        method: "POST",
        body: formData,
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "No se pudo adjuntar el PDF")
      showSuccessToast("Éxito", "Comprobante adjuntado")
    } catch (error) {
      showErrorToast("No se pudo adjuntar el PDF", error instanceof Error ? error.message : undefined)
    } finally {
      setCargando(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Comprobante PDF
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={verPdf} disabled={cargando}>
            Ver PDF
          </Button>
          {puedeSubir && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  if (archivo) subirPdf(archivo)
                }}
              />
              <Button onClick={() => inputRef.current?.click()} disabled={cargando}>
                Adjuntar / reemplazar PDF
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
