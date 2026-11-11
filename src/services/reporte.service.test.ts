import { describe, it, expect, vi, beforeEach } from "vitest"
import { ReporteRepository } from "@/repositories/reporte.repository"
import { ProveedorService } from "@/services/proveedor.service"
import { ProyectoService } from "@/services/proyecto.service"
import { REPORTES } from "./reporte.service"

vi.mock("@/repositories/reporte.repository", () => ({
  ReporteRepository: {
    circuito: vi.fn(),
    circuitoMensual: vi.fn(),
    pendienteCertificar: vi.fn(),
    deuda: vi.fn(),
    proveedores: vi.fn(),
    proyectos: vi.fn(),
  },
}))
vi.mock("@/services/proveedor.service", () => ({ ProveedorService: { getById: vi.fn() } }))
vi.mock("@/services/proyecto.service", () => ({ ProyectoService: { getById: vi.fn() } }))

const repo = vi.mocked(ReporteRepository)
const proveedorSvc = vi.mocked(ProveedorService)
const proyectoSvc = vi.mocked(ProyectoService)

const PERIODO = { desde: "2026-01-01", hasta: "2026-06-30" }

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of Object.values(repo)) fn.mockResolvedValue([] as never)
  proveedorSvc.getById.mockResolvedValue(null as never)
  proyectoSvc.getById.mockResolvedValue(null as never)
})

describe("REPORTES (registry)", () => {
  it("expone los seis reportes más el combinado 'todos'", () => {
    expect(Object.keys(REPORTES).sort()).toEqual(
      [
        "circuito",
        "circuito-mensual",
        "deuda",
        "pendiente-certificar",
        "proveedores",
        "proyectos",
        "todos",
      ].sort()
    )
  })
})

describe("generar — validación de filtros", () => {
  it("rechaza un período invertido (desde > hasta) sin consultar la base", async () => {
    await expect(
      REPORTES.deuda.generar({ desde: "2026-06-30", hasta: "2026-01-01" })
    ).rejects.toThrow()
    expect(repo.deuda).not.toHaveBeenCalled()
  })

  it("rechaza una moneda que no existe", async () => {
    await expect(REPORTES.deuda.generar({ ...PERIODO, moneda: "BTC" })).rejects.toThrow()
  })

  it("sin período explícito acota a los últimos 12 meses (nunca 'todo')", async () => {
    await REPORTES.deuda.generar({})
    const filtros = repo.deuda.mock.calls[0][0]
    expect(filtros.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(filtros.hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(filtros.desde < filtros.hasta).toBe(true)
  })

  it("moneda 'todas' llega al repo como null, y por defecto es ARS", async () => {
    await REPORTES.deuda.generar({ ...PERIODO, moneda: "todas" })
    expect(repo.deuda.mock.calls[0][0].moneda).toBeNull()

    await REPORTES.deuda.generar(PERIODO)
    expect(repo.deuda.mock.calls[1][0].moneda).toBe("ARS")
  })

  it("coacciona los ids que llegan como string de query", async () => {
    await REPORTES.deuda.generar({ ...PERIODO, proveedorId: "5" })
    expect(repo.deuda.mock.calls[0][0].proveedorId).toBe(5)
  })
})

describe("generar — armado de la tabla", () => {
  it("usa las columnas del reporte y totaliza solo las de moneda", async () => {
    repo.deuda.mockResolvedValue([
      { moneda: "ARS", total_facturado: 1000, pagado: 400, saldo: 600, dias: 10 },
      { moneda: "ARS", total_facturado: 500, pagado: 0, saldo: 500, dias: 20 },
    ] as never)

    const { tablas, titulo } = await REPORTES.deuda.generar(PERIODO)
    expect(titulo).toBe("Deuda con proveedores")
    expect(tablas).toHaveLength(1)
    expect(tablas[0].columnas.map((c) => c.clave)).toContain("saldo")
    expect(tablas[0].totales).toMatchObject({ total_facturado: 1500, pagado: 400, saldo: 1100 })
    // dias es numero, no moneda: no se totaliza
    expect(tablas[0].totales).not.toHaveProperty("dias")
  })

  it("no totaliza si las filas mezclan monedas", async () => {
    repo.deuda.mockResolvedValue([
      { moneda: "ARS", saldo: 600 },
      { moneda: "USD", saldo: 500 },
    ] as never)
    const { tablas } = await REPORTES.deuda.generar({ ...PERIODO, moneda: "todas" })
    expect(tablas[0].totales).toEqual({})
  })

  // Los nombres que encabezan el archivo se resuelven contra la base: si se tomaran del
  // body, cualquiera imprime el proveedor que quiera en algo con apariencia oficial.
  it("resuelve los nombres de los filtros contra la base, no desde el body", async () => {
    proveedorSvc.getById.mockResolvedValue({ id: 5, nombre: "Hormigonera Sur" } as never)
    proyectoSvc.getById.mockResolvedValue({ id: 3, nombre: "Obra Norte" } as never)

    const { tablas } = await REPORTES.deuda.generar({
      ...PERIODO,
      proveedorId: 5,
      proyectoId: 3,
      proveedor: "ACME SA (inventado por el cliente)",
    })

    expect(proveedorSvc.getById).toHaveBeenCalledWith(5)
    expect(tablas[0].filtros.Proveedor).toBe("Hormigonera Sur")
    expect(tablas[0].filtros.Proyecto).toBe("Obra Norte")
    expect(JSON.stringify(tablas[0].filtros)).not.toContain("ACME")
  })

  it("sin ids de filtro no consulta nombres y describe 'Todos'", async () => {
    const { tablas } = await REPORTES.deuda.generar(PERIODO)
    expect(proveedorSvc.getById).not.toHaveBeenCalled()
    expect(proyectoSvc.getById).not.toHaveBeenCalled()
    expect(tablas[0].filtros.Proveedor).toBe("Todos")
  })
})

describe("generar — reportes combinados", () => {
  it("'circuito' trae la tabla del circuito y la de evolución mensual", async () => {
    repo.circuito.mockResolvedValue([{ moneda: "ARS", comprado: 10 }] as never)
    repo.circuitoMensual.mockResolvedValue([{ moneda: "ARS", mes: "2026-01", comprado: 10 }] as never)

    const { tablas } = await REPORTES.circuito.generar(PERIODO)
    expect(tablas.map((t) => t.titulo)).toEqual([
      "Circuito de compras",
      "Evolución mensual del circuito",
    ])
  })

  it("'todos' encadena las seis tablas con los mismos filtros", async () => {
    const { tablas, filtros } = await REPORTES.todos.generar(PERIODO)
    expect(tablas).toHaveLength(6)
    expect(filtros.desde).toBe("2026-01-01")
    for (const consulta of Object.values(repo)) {
      expect(consulta).toHaveBeenCalledTimes(1)
    }
  })
})
