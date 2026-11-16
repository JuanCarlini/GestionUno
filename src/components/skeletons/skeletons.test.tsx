import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  ListSkeleton,
  DetailSkeleton,
  FormSkeleton,
  DashboardSkeleton,
  ReportesSkeleton,
  PageHeaderSkeleton,
  TabReporteSkeleton,
  VolverSkeleton,
} from "."

// Un skeleton mal anunciado es peor que ninguno: el lector de pantalla lee una pila de divs
// vacíos sin decir que son un placeholder. Estos tests fijan el contrato accesible.
//
// Sin jest-dom a propósito (el proyecto no lo tiene): las aserciones van con la API del DOM,
// que dice lo mismo con una línea más.
const SKELETONS = [
  ["ListSkeleton", <ListSkeleton key="l" />, "Cargando el listado"],
  ["DetailSkeleton", <DetailSkeleton key="d" />, "Cargando el documento"],
  ["FormSkeleton", <FormSkeleton key="f" />, "Cargando el formulario"],
  ["DashboardSkeleton", <DashboardSkeleton key="da" />, "Cargando el dashboard"],
  ["ReportesSkeleton", <ReportesSkeleton key="r" />, "Cargando los reportes"],
] as const

describe("skeletons — contrato accesible", () => {
  it.each(SKELETONS)("%s se anuncia como status ocupado", (_nombre, elemento, etiqueta) => {
    render(elemento)

    const status = screen.getByRole("status")
    expect(status.getAttribute("aria-busy")).toBe("true")
    expect(status.getAttribute("aria-label")).toBe(etiqueta)
  })

  it.each(SKELETONS)("%s dice qué está cargando, también en texto", (_n, elemento, etiqueta) => {
    render(elemento)
    expect(screen.getByText(etiqueta)).toBeTruthy()
  })

  // La animación de pulso es decorativa: para alguien con sensibilidad al movimiento es ruido.
  it.each(SKELETONS)("%s respeta prefers-reduced-motion", (_n, elemento) => {
    const { container } = render(elemento)

    const animados = container.querySelectorAll(".animate-pulse")
    expect(animados.length, "el skeleton tiene que animar algo").toBeGreaterThan(0)

    for (const nodo of animados) {
      expect(
        nodo.className,
        `una barra animada sin motion-reduce: ${nodo.className}`
      ).toContain("motion-reduce:animate-none")
    }
  })
})

describe("skeletons — forma de la pantalla", () => {
  // El punto del skeleton es que el layout no salte: si muestra 3 filas y llegan 8, salta.
  it("el listado muestra 8 filas por defecto, las mismas que la página", () => {
    const { container } = render(<ListSkeleton />)
    expect(container.querySelectorAll('[data-skeleton="fila"]').length).toBe(8)
  })

  it("el listado acepta otra cantidad de filas", () => {
    const { container } = render(<ListSkeleton filas={3} />)
    expect(container.querySelectorAll('[data-skeleton="fila"]').length).toBe(3)
  })

  it("el listado acepta una etiqueta propia, para decir qué listado es", () => {
    render(<ListSkeleton etiqueta="Cargando órdenes de compra" />)
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "Cargando órdenes de compra"
    )
  })

  it("el formulario puede ir sin la tabla de líneas (proveedores, proyectos)", () => {
    const { container: con } = render(<FormSkeleton />)
    const { container: sin } = render(<FormSkeleton conLineas={false} />)
    expect(sin.querySelectorAll("*").length).toBeLessThan(con.querySelectorAll("*").length)
  })

  it("el dashboard muestra 4 KPIs y los 2 paneles de abajo", () => {
    const { container } = render(<DashboardSkeleton />)
    expect(container.querySelectorAll('[data-skeleton="kpi"]').length).toBe(4)
    expect(container.querySelectorAll('[data-skeleton="panel"]').length).toBe(2)
  })

  // Medido contra la app desplegada: el detalle de una certificación muestra 4 campos
  // (OC, fecha, proveedor, observaciones). Con 6, la tarjeta quedaba más alta de lo que
  // llegaba y lo de abajo subía al cargar.
  it("el detalle muestra 4 campos por defecto, los que tiene la pantalla", () => {
    const { container } = render(<DetailSkeleton />)
    // Cada campo es una etiqueta corta sobre un valor más ancho.
    const anchos = [...container.querySelectorAll(".h-3.w-28")]
    expect(anchos.length).toBe(4)
  })

  it("el detalle acepta otra cantidad de campos", () => {
    const { container } = render(<DetailSkeleton campos={6} />)
    expect(container.querySelectorAll(".h-3.w-28").length).toBe(6)
  })

  it("la grilla de tiles sigue a la cantidad: con 4 no se parte en dos filas", () => {
    // Clases enteras y no interpoladas: Tailwind escanea el fuente y nunca generaría
    // una clase armada con `md:grid-cols-${n}`.
    const { container } = render(<TabReporteSkeleton tiles={4} />)
    expect(container.querySelector(".md\\:grid-cols-4")).toBeTruthy()
    expect(container.querySelectorAll('[data-skeleton="tile"]').length).toBe(4)

    const { container: tres } = render(<TabReporteSkeleton />)
    expect(tres.querySelector(".md\\:grid-cols-3")).toBeTruthy()
  })

  it("una pestaña sin indicadores no dibuja la fila de tiles", () => {
    const { container } = render(<TabReporteSkeleton tiles={0} />)
    expect(container.querySelectorAll('[data-skeleton="tile"]').length).toBe(0)
  })

  it("la barra de volver es chica: arriba del detalle no hay título ni descripción", () => {
    const { container } = render(<VolverSkeleton />)
    // Dos barras en una fila, no un bloque de dos renglones más un botón.
    expect(container.querySelectorAll(".animate-pulse").length).toBe(2)
  })

  // Quién dibuja la barra de "Volver" cambia por pantalla: en órdenes de compra la pone la
  // page y queda montada mientras el cliente busca; en el resto la pone la vista, y ahí el
  // skeleton tiene que reservarle el lugar o la tarjeta baja ~50px al cargar.
  it("el detalle no reserva lugar para el volver salvo que se lo pidan", () => {
    const { container } = render(<DetailSkeleton />)
    expect(container.querySelector('[data-skeleton="volver"]')).toBeNull()
  })

  it("el detalle con conVolver reserva el lugar de la barra", () => {
    const { container } = render(<DetailSkeleton conVolver />)
    expect(container.querySelector('[data-skeleton="volver"]')).toBeTruthy()
  })

  it("el formulario también puede reservar el volver", () => {
    const { container } = render(<FormSkeleton conVolver />)
    expect(container.querySelector('[data-skeleton="volver"]')).toBeTruthy()
  })

  it("el encabezado de página no se anuncia como status (va dentro de otro)", () => {
    render(<PageHeaderSkeleton />)
    expect(screen.queryByRole("status")).toBeNull()
  })
})
