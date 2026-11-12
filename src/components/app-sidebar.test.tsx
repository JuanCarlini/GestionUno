import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { SidebarProvider } from "@/components/ui/sidebar"

// El menú es la única forma de moverse por la app. Lo que fija este test: que sea un landmark
// de navegación (para poder saltar directo ahí) y que diga cuál es la página actual. El fondo
// gris del item activo solo se lo cuenta a quien lo ve.

let rutaActual = "/dashboard"
vi.mock("next/navigation", () => ({
  usePathname: () => rutaActual,
  useRouter: () => ({ push: vi.fn() }),
}))

let sesion: { rol: string; permisos: string[] } = { rol: "admin", permisos: [] }
vi.mock("@/components/auth-context", () => ({
  useAuth: () => ({
    user: { nombre: "Tester", email: "tester@example.test", rol: sesion.rol },
    // Lista blanca: solo los módulos de `permisos` se pueden ver.
    puede: (modulo: string) => sesion.permisos.includes(modulo),
  }),
}))

import { AppSidebar } from "./app-sidebar"

beforeAll(() => {
  // jsdom no trae matchMedia y el Sidebar lo usa para saber si está en pantalla chica.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

function montar({
  ruta = "/dashboard",
  rol = "admin",
  permisos = ["ordenes_compra", "certificaciones", "facturas", "ordenes_pago", "proveedores", "proyectos", "reportes"],
}: { ruta?: string; rol?: string; permisos?: string[] } = {}) {
  rutaActual = ruta
  sesion = { rol, permisos }
  return render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  )
}

describe("AppSidebar — poder moverse por la app", () => {
  it("el menú es un landmark de navegación con nombre", () => {
    montar()
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeTruthy()
  })

  it("marca la página actual con aria-current", () => {
    montar({ ruta: "/facturas" })

    const menu = screen.getByRole("navigation", { name: "Navegación principal" })
    const actual = within(menu).getByRole("link", { name: "Facturas" })
    expect(actual.getAttribute("aria-current")).toBe("page")
  })

  it("solo una página es la actual: el resto no lleva aria-current", () => {
    montar({ ruta: "/facturas" })

    const menu = screen.getByRole("navigation", { name: "Navegación principal" })
    const marcados = within(menu)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page")

    expect(marcados.length).toBe(1)
  })

  it("en una ruta de detalle no marca nada: /facturas/42 no es /facturas", () => {
    // Comportamiento de hoy, escrito para que se vea: el resaltado es por igualdad exacta.
    // Si alguna vez se quiere que el detalle resalte su sección, este test lo va a decir.
    montar({ ruta: "/facturas/42" })

    const menu = screen.getByRole("navigation", { name: "Navegación principal" })
    const marcados = within(menu)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page")

    expect(marcados.length).toBe(0)
  })
})

describe("AppSidebar — qué muestra según el rol", () => {
  it("no lista los módulos que el rol no puede ver", () => {
    montar({ rol: "usuario", permisos: ["ordenes_compra"] })

    expect(screen.getByRole("link", { name: "Órdenes de Compra" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Facturas" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Reportes" })).toBeNull()
  })

  it("Inicio siempre está, no es un módulo de la matriz", () => {
    montar({ rol: "usuario", permisos: [] })
    expect(screen.getByRole("link", { name: "Inicio" })).toBeTruthy()
  })

  it("un admin ve la sección de administración", () => {
    montar({ rol: "admin", permisos: [] })
    expect(screen.getByRole("link", { name: "Gestión de Usuarios" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Auditoría" })).toBeTruthy()
  })

  it("un supervisor no la ve", () => {
    montar({ rol: "supervisor", permisos: [] })
    expect(screen.queryByRole("link", { name: "Gestión de Usuarios" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Auditoría" })).toBeNull()
  })
})
