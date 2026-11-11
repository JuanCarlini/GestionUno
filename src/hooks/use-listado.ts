"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/shared/api-client"
import type { CuerpoPaginado } from "@/lib/route/paginacion"

// Estado de un listado paginado: página, filtros y orden, sincronizados con la URL.
//
// Por qué no useSearchParams + router.replace, que es lo que hace FiltrosBar de reportes: ahí
// los filtros son parámetros que lee un Server Component, así que la navegación es necesaria.
// Acá el listado es client-side y re-navegar vuelve a correr la página entera en el servidor
// por cada tecla. Con history.replaceState la URL queda igual de compartible y, de paso, el
// hook no obliga a envolver cada vista en un <Suspense> (useSearchParams lo exige en Next 15:
// sin él, el build rompe el prerenderizado).

const DEBOUNCE_MS = 300

export interface Listado<T> {
  items: T[]
  total: number
  page: number
  limit: number
  paginas: number
  /** Primera carga: todavía no hay nada que mostrar. */
  loading: boolean
  /** Hay datos en pantalla y se está pidiendo otra página o otro filtro. */
  refrescando: boolean
  error: string | null

  /** Texto del buscador (inmediato, para el input). La request va con debounce. */
  q: string
  setQ: (valor: string) => void
  estado: string
  setEstado: (valor: string) => void
  /** "columna.dir" */
  orden: string
  setOrden: (valor: string) => void

  irA: (page: number) => void
  recargar: () => void
  /** Para que las vistas actualicen una fila después de una mutación, sin re-pedir la página. */
  setItems: React.Dispatch<React.SetStateAction<T[]>>
}

function leerDeLaUrl(clave: string, porDefecto: string): string {
  if (typeof window === "undefined") return porDefecto
  return new URLSearchParams(window.location.search).get(clave) ?? porDefecto
}

export function useListado<T>(
  recurso: string,
  cfg: { ordenInicial: string; limit?: number }
): Listado<T> {
  const limit = cfg.limit ?? 25

  // El estado arranca de la URL: recargar o compartir el link reproduce la misma vista.
  const [page, setPage] = useState(() => Number(leerDeLaUrl("page", "1")) || 1)
  const [q, setQ] = useState(() => leerDeLaUrl("q", ""))
  const [estado, setEstado] = useState(() => leerDeLaUrl("estado", ""))
  const [orden, setOrden] = useState(() => leerDeLaUrl("orden", cfg.ordenInicial))

  // El buscador escribe acá con debounce: sin esto cada tecla es una request.
  const [qAplicado, setQAplicado] = useState(q)

  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  // Si no hay datos en pantalla es "loading"; si hay, es "refrescando" y la tabla se queda
  // visible (atenuada) en vez de volver al skeleton.
  const hayDatos = useRef(false)

  useEffect(() => {
    const reloj = setTimeout(() => setQAplicado(q), DEBOUNCE_MS)
    return () => clearTimeout(reloj)
  }, [q])

  // Cualquier cambio de filtro vuelve a la página 1: quedarse en la 3 de un resultado que
  // ahora tiene una sola página muestra una tabla vacía.
  //
  // Menos al montar: ahí los filtros no cambiaron, se leyeron de la URL, y resetear pisaba la
  // página de un link compartido con ?page=3.
  const montado = useRef(false)
  useEffect(() => {
    if (!montado.current) {
      montado.current = true
      return
    }
    setPage(1)
  }, [qAplicado, estado, orden])

  const query = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(limit), orden })
    if (qAplicado) p.set("q", qAplicado)
    if (estado) p.set("estado", estado)
    return p
  }, [page, limit, orden, qAplicado, estado])

  useEffect(() => {
    let cancelado = false
    const p = query()

    if (hayDatos.current) setRefrescando(true)
    else setLoading(true)

    api(`${recurso}?${p.toString()}`)
      .then((cuerpo: CuerpoPaginado<T>) => {
        if (cancelado) return
        setItems(cuerpo.data)
        setTotal(cuerpo.total)
        setError(null)
        hayDatos.current = true
      })
      .catch((e: unknown) => {
        if (cancelado) return
        setError(e instanceof Error ? e.message : "Error desconocido")
      })
      .finally(() => {
        if (cancelado) return
        setLoading(false)
        setRefrescando(false)
      })

    // La URL refleja el estado del listado, sin navegar (ver el comentario de arriba).
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`)
    }

    // Una respuesta vieja que llega tarde no puede pisar a la nueva.
    return () => {
      cancelado = true
    }
  }, [recurso, query, recarga])

  return {
    items,
    total,
    page,
    limit,
    paginas: Math.max(1, Math.ceil(total / limit)),
    loading,
    refrescando,
    error,
    q,
    setQ,
    estado,
    setEstado,
    orden,
    setOrden,
    irA: setPage,
    recargar: () => setRecarga((n) => n + 1),
    setItems,
  }
}
