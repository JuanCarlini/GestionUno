"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { api } from "@/shared/api-client"
import type { TablaReporte } from "@/lib/export/tipos"

interface ResultadoReporte {
  titulo: string
  filtros: Record<string, unknown>
  tablas: TablaReporte[]
}

// Cancela la petición anterior al cambiar un filtro: sin esto una respuesta lenta pisa
// a una posterior y la pantalla muestra números que no son los del filtro visible.
export function useReporte(nombre: string) {
  const searchParams = useSearchParams()
  const query = searchParams.toString()

  const [reporte, setReporte] = useState<ResultadoReporte | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const control = new AbortController()

    async function traer() {
      setLoading(true)
      try {
        setReporte(await api(`/api/reportes/${nombre}?${query}`, { signal: control.signal }))
        setError(null)
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        // Se conserva el reporte anterior a propósito: vaciar la pantalla ante un
        // fallo de red descarta lo que el usuario estaba leyendo.
        setError(e instanceof Error ? e.message : "Error desconocido")
      } finally {
        if (!control.signal.aborted) setLoading(false)
      }
    }

    traer()
    return () => control.abort()
  }, [nombre, query])

  return { reporte, loading, error }
}
