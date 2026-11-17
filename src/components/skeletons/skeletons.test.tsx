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
  UsuariosSkeleton,
  AuditoriaSkeleton,
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
  ["UsuariosSkeleton", <UsuariosSkeleton key="u" />, "Cargando la administración de usuarios"],
  ["AuditoriaSkeleton", <AuditoriaSkeleton key="a" />, "Cargando la auditoría"],
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
  //
  // 8 no es el tamaño de página: la página trae 25 (use-listado.ts). Son las que entran en
  // una pantalla; dibujar 25 barras grises sería una pared, y el salto de la 9 en adelante
  // pasa abajo del pliegue. El comentario de antes decía que eran "las mismas que la
  // página" y no era cierto.
  it("el listado muestra 8 filas por defecto, las que entran en una pantalla", () => {
    const { container } = render(<ListSkeleton />)
    expect(container.querySelectorAll('[data-skeleton="fila"]').length).toBe(8)
  })

  // Lo que se escapó una vez: la fila del skeleton tenía las acciones colgadas afuera del
  // grid, así que eran cinco bloques contra los cuatro de la fila real y los botones se
  // dibujaban contra el borde derecho en vez de en su columna. Esto lo fija.
  it("la fila repite las 4 columnas de la lista, con las acciones adentro", () => {
    const { container } = render(<ListSkeleton filas={1} />)
    const fila = container.querySelector('[data-skeleton="fila"]')!
    const grid = fila.querySelector(".md\\:grid-cols-4")!

    expect(grid.children.length, "4 columnas: número, proveedor, monto y acción").toBe(4)
    expect(fila.children.length, "nada colgado al lado del grid").toBe(1)
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

describe("skeletons — las pantallas que no son un listado del circuito", () => {
  // PageHeaderSkeleton dibujaba siempre la acción de la derecha, y 12 de las 18 pantallas
  // que lo usan tienen un PageHeader sin botón: les aparecía un rectángulo de 144px que al
  // llegar los datos se desvanecía.
  it("el encabezado dibuja la acción solo donde la hay", () => {
    const { container: con } = render(<PageHeaderSkeleton />)
    const { container: sin } = render(<PageHeaderSkeleton conAccion={false} />)

    expect(con.querySelectorAll(".h-10.w-36").length, "con acción").toBe(1)
    expect(sin.querySelectorAll(".h-10.w-36").length, "sin acción").toBe(0)
  })

  // Usaban ListSkeleton, que dibuja la fila del circuito: número, proveedor, monto, estado
  // y un botón. Ninguna de las dos pantallas tiene esa forma.
  it("usuarios: dos tabs, el alta aparte y filas con el select de rol", () => {
    const { container } = render(<UsuariosSkeleton filas={3} />)

    expect(container.querySelectorAll('[data-skeleton="fila-usuario"]').length).toBe(3)
    // El select de rol es la tercera columna de cada fila; sin él la fila mide otra cosa.
    expect(container.querySelectorAll(".h-10.w-full").length).toBe(3)
    expect(container.querySelector(".bg-muted"), "la barra de tabs").toBeTruthy()
  })

  it("auditoría: la búsqueda de cinco filtros y la tabla de seis columnas", () => {
    const { container } = render(<AuditoriaSkeleton filas={4} />)

    // Cinco filtros arriba, cada uno con su etiqueta y su control.
    expect(container.querySelectorAll('[data-skeleton="filtro"]').length).toBe(5)
    expect(container.querySelectorAll('[data-skeleton="fila-auditoria"]').length).toBe(4)
    // Seis columnas por fila, las mismas que la Table de la pantalla.
    const fila = container.querySelector('[data-skeleton="fila-auditoria"]')!
    expect(fila.children.length).toBe(6)
  })
})
