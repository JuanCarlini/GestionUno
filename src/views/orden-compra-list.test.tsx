import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { OrdenCompraList } from "./orden-compra-list"

// El bug que cubre este test: la lista decidía si mostrar Aprobar/Anular con
// canAnularDocumento(stringToUserRole(user.rol)), que mapea cualquier rol que no sea
// admin/supervisor/readonly a "usuario". Un rol custom con ordenes_compra:aprobar podía
// anular por la API (requirePermission lo deja) y no veía el botón.
// El usuario del contexto es un rol custom con el permiso en su matriz: así, si alguien
// vuelve a decidir por rol, el test falla por el motivo original del bug.
const USER = {
  id: 3,
  nombre: "Capataz",
  email: "capataz@obra.com",
  rol: "capataz",
  permisos: ["ordenes_compra:ver", "ordenes_compra:aprobar"],
}

const puede = vi.fn()
vi.mock("@/components/auth-context", () => ({
  useAuth: () => ({ user: USER, loading: false, refreshUser: vi.fn(), puede }),
}))

const cambiarEstadoOrden = vi.fn()
// El hook ahora expone el estado del listado paginado (useListado) ademas de las acciones de
// dominio: la vista ya no filtra ni ordena en memoria.
vi.mock("@/hooks/use-orders", () => ({
  useOrders: () => ({
    orders: [
      { id: 1, numero_oc: "OC-0012", estado: "borrador", total_con_iva: 1000, moneda: "ARS" },
      { id: 2, numero_oc: "OC-0013", estado: "aprobado", total_con_iva: 2000, moneda: "ARS" },
    ],
    total: 2,
    page: 1,
    paginas: 1,
    limit: 25,
    loading: false,
    refrescando: false,
    error: null,
    q: "",
    setQ: vi.fn(),
    estado: "",
    setEstado: vi.fn(),
    orden: "created_at.desc",
    setOrden: vi.fn(),
    irA: vi.fn(),
    recargar: vi.fn(),
    setItems: vi.fn(),
    cambiarEstadoOrden,
  }),
}))

// next/link necesita el router del App Router montado; en un test unitario alcanza el <a>.
// El resto de las props se pasan tal cual: si no, se pierde el aria-label del link de Ver.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

beforeEach(() => vi.clearAllMocks())

describe("OrdenCompraList — gating de los botones de estado", () => {
  it("un rol con ordenes_compra:aprobar ve Anular, aunque no sea admin ni supervisor", () => {
    // Rol custom "capataz": la matriz le da aprobar, que es lo único que importa acá.
    puede.mockImplementation(
      (modulo: string, accion: string) => modulo === "ordenes_compra" && accion === "aprobar"
    )

    render(<OrdenCompraList />)

    expect(puede).toHaveBeenCalledWith("ordenes_compra", "aprobar")
    expect(screen.getAllByLabelText("Anular orden de compra")).toHaveLength(1)
    expect(screen.getAllByLabelText("Mandar a aprobar")).toHaveLength(1)
  })

  it("sin el permiso no se muestran los botones de transición", () => {
    puede.mockReturnValue(false)

    render(<OrdenCompraList />)

    expect(screen.queryByLabelText("Anular orden de compra")).toBeNull()
    expect(screen.queryByLabelText("Mandar a aprobar")).toBeNull()
    // Ver sigue estando: el gating es de las acciones, no de la fila.
    expect(screen.getAllByLabelText(/Ver orden/i).length).toBeGreaterThan(0)
  })

  it("solo las OC editables ofrecen transición (una aprobada no)", () => {
    puede.mockReturnValue(true)

    render(<OrdenCompraList />)

    // De las dos filas, solo la borrador ofrece Anular; la aprobada no.
    expect(screen.getAllByLabelText("Anular orden de compra")).toHaveLength(1)
    expect(screen.getByText("OC-0013")).toBeTruthy()
  })
})
