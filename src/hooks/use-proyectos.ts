"use client"

import { useCallback, useEffect, useState } from "react"
import type { Proyecto } from "@/models/proyecto.model"
import { api } from "@/shared/api-client"

export function useProyectos() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshProyectos = useCallback(async () => {
    setLoading(true)
    try {
      setProyectos(await api("/api/proyectos"))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProyectos()
  }, [refreshProyectos])

  return { proyectos, loading, error, refreshProyectos }
}
