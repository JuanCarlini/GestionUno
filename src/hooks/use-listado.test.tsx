import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { useListado } from "./use-listado"

// El hook pega con api(), que envuelve fetch. Se mockea el wrapper y no fetch: lo que importa
// acá es la URL que arma el hook y qué hace con la respuesta.
const api = vi.hoisted(() => vi.fn())
vi.mock("@/shared/api-client", () => ({ api }))

const pagina = (data: unknown[], total = data.length) => ({
  data,
  total,
  page: 1,
  limit: 25,
  next: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  api.mockResolvedValue(pagina([{ id: 1 }]))
  window.history.replaceState(null, "", "/ordenes-compra")
})

afterEach(() => {
  vi.useRealTimers()
})

const urlDeLaLlamada = (n = 0) => String(api.mock.calls[n][0])

describe("useListado", () => {
  it("pide la primera página con el orden inicial", async () => {
    const { result } = renderHook(() =>
      useListado("/api/ordenes-compra", { ordenInicial: "created_at.desc" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(urlDeLaLlamada()).toBe("/api/ordenes-compra?page=1&limit=25&orden=created_at.desc")
    expect(result.current.items).toEqual([{ id: 1 }])
  })

  it("expone el total y la cantidad de páginas", async () => {
    api.mockResolvedValue(pagina([{ id: 1 }], 60))

    const { result } = renderHook(() =>
      useListado("/api/ordenes-compra", { ordenInicial: "created_at.desc" })
    )

    await waitFor(() => expect(result.current.total).toBe(60))
    expect(result.current.paginas).toBe(3)
  })

  // El estado arranca de la URL: recargar o compartir el link reproduce la misma vista.
  it("toma la página, el filtro y el orden de la URL", async () => {
    window.history.replaceState(null, "", "/ordenes-compra?page=3&q=cemento&estado=aprobado&orden=fecha_oc.asc")

    const { result } = renderHook(() =>
      useListado("/api/ordenes-compra", { ordenInicial: "created_at.desc" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.page).toBe(3)
    expect(result.current.q).toBe("cemento")
    expect(urlDeLaLlamada()).toContain("page=3")
    expect(urlDeLaLlamada()).toContain("orden=fecha_oc.asc")
    expect(urlDeLaLlamada()).toContain("estado=aprobado")
  })

  it("refleja el estado en la URL sin navegar", async () => {
    const { result } = renderHook(() =>
      useListado("/api/ordenes-compra", { ordenInicial: "created_at.desc" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(window.location.search).toContain("page=1")

    act(() => result.current.irA(2))
    await waitFor(() => expect(window.location.search).toContain("page=2"))
    // El pathname no cambia: no hubo navegación.
    expect(window.location.pathname).toBe("/ordenes-compra")
  })

  // Quedarse en la página 3 de un resultado que ahora tiene una sola muestra una tabla vacía.
  it("un cambio de filtro vuelve a la página 1", async () => {
    const { result } = renderHook(() =>
      useListado("/api/ordenes-compra", { ordenInicial: "created_at.desc" })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.irA(3))
    await waitFor(() => expect(result.current.page).toBe(3))

    act(() => result.current.setEstado("aprobado"))
    await waitFor(() => expect(result.current.page).toBe(1))
  })

  it("el buscador va con debounce: escribir no dispara una request por tecla", async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useListado("/api/ordenes-compra", { ordenInicial: "created_at.desc" })
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    const llamadasIniciales = api.mock.calls.length

    act(() => result.current.setQ("c"))
    act(() => result.current.setQ("ce"))
    act(() => result.current.setQ("cem"))

    // Todavía dentro de la ventana del debounce: ninguna request nueva.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(api.mock.calls.length).toBe(llamadasIniciales)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(api.mock.calls.length).toBe(llamadasIniciales + 1)
    expect(urlDeLaLlamada(llamadasIniciales)).toContain("q=cem")
  })

  // Mientras llega otra página, la tabla se queda visible: la vista la atenúa en vez de
  // volver al skeleton.
  it("la segunda carga es 'refrescando', no 'loading'", async () => {
    const { result } = renderHook(() =>
      useListado("/api/ordenes-compra", { ordenInicial: "created_at.desc" })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    let resolver: (v: unknown) => void = () => {}
    api.mockReturnValue(new Promise((r) => (resolver = r)))

    act(() => result.current.irA(2))

    await waitFor(() => expect(result.current.refrescando).toBe(true))
    expect(result.current.loading).toBe(false)
    expect(result.current.items).toEqual([{ id: 1 }])

    await act(async () => {
      resolver(pagina([{ id: 2 }]))
    })
    await waitFor(() => expect(result.current.refrescando).toBe(false))
  })

  it("guarda el error y no rompe el listado", async () => {
    api.mockRejectedValue(new Error("No autenticado"))

    const { result } = renderHook(() =>
      useListado("/api/ordenes-compra", { ordenInicial: "created_at.desc" })
    )

    await waitFor(() => expect(result.current.error).toBe("No autenticado"))
    expect(result.current.items).toEqual([])
  })

  it("setItems deja a la vista reemplazar una fila sin re-pedir la página", async () => {
    const { result } = renderHook(() =>
      useListado<{ id: number; estado?: string }>("/api/ordenes-compra", {
        ordenInicial: "created_at.desc",
      })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    const llamadas = api.mock.calls.length

    act(() => result.current.setItems((prev) => prev.map((i) => ({ ...i, estado: "aprobado" }))))

    expect(result.current.items).toEqual([{ id: 1, estado: "aprobado" }])
    expect(api.mock.calls.length).toBe(llamadas)
  })
})
