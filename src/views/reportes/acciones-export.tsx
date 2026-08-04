"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Download, Printer, Sheet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

// Botones de exportacion: Excel pega contra la API, PDF es window.print() con la
// hoja @media print (grafico vectorial gratis, sin rasterizar).
// La descarga va por fetch + blob: navegar a la URL sacaba al usuario de la pantalla
// (y ante un 4xx/5xx le mostraba el JSON crudo, perdiendo filtros y pestana activa).
export function AccionesExport({ reporte }: { reporte: string }) {
  const params = useSearchParams()
  const [descargando, setDescargando] = useState(false)

  // cual: "todos" trae los seis reportes en un libro, una hoja por reporte, con los
  // mismos filtros de la pantalla.
  async function descargar(formato: string, cual = reporte) {
    setDescargando(true)
    try {
      const query = new URLSearchParams(params.toString())
      query.set("formato", formato)
      const res = await fetch(`/api/reportes/${cual}/export?${query.toString()}`)
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}))
        throw new Error(cuerpo.error ?? `Error ${res.status}`)
      }

      const blob = await res.blob()
      const nombre =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `reporte-${cual}.${formato}`
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement("a")
      enlace.href = url
      enlace.download = nombre
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el archivo")
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="no-imprimir flex gap-2">
      <Button variant="outline" size="sm" disabled={descargando} onClick={() => descargar("xlsx")}>
        <Download className="mr-2 h-4 w-4" />
        {descargando ? "Generando…" : "Excel"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={descargando}
        onClick={() => descargar("xlsx", "todos")}
        title="Todos los reportes en un libro, una hoja por reporte"
      >
        <Sheet className="mr-2 h-4 w-4" />
        Excel completo
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" />
        PDF
      </Button>
    </div>
  )
}
