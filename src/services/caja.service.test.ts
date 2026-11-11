import { describe, it, expect, vi, beforeEach } from "vitest"
import { CajaRepository } from "@/repositories/caja.repository"
import { CajaService } from "./caja.service"

vi.mock("@/repositories/caja.repository", () => ({
  CajaRepository: {
    findAllActive: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    setActive: vi.fn(),
  },
}))

const repo = vi.mocked(CajaRepository)

beforeEach(() => {
  vi.clearAllMocks()
  repo.insert.mockResolvedValue({ id: 1 } as never)
})

describe("CajaService.create", () => {
  it("fuerza is_active=true; el cliente no elige el estado (S2)", async () => {
    await CajaService.create({ nombre: "Galicia", tipo: "banco", moneda: "ARS" } as never)
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Galicia", tipo: "banco", moneda: "ARS", is_active: true })
    )
  })
})

describe("CajaService.delete — baja lógica", () => {
  it("no borra: marca is_active=false (hay líneas de OP apuntando)", async () => {
    repo.findById.mockResolvedValue({ id: 3 } as never)
    repo.setActive.mockResolvedValue(true)

    await CajaService.delete(3)

    expect(repo.setActive).toHaveBeenCalledWith(3, false)
  })

  it("404 si la caja no existe", async () => {
    repo.findById.mockResolvedValue(null)
    await expect(CajaService.delete(99)).rejects.toMatchObject({ status: 404 })
    expect(repo.setActive).not.toHaveBeenCalled()
  })
})

describe("CajaService.update", () => {
  it("no deja cambiar la moneda de una caja ya creada", async () => {
    // fn_op_gate exige que todas las cajas de una OP compartan su moneda: cambiarla
    // a posteriori invalidaría en silencio las OP ya aprobadas que la usan.
    repo.findById.mockResolvedValue({ id: 3, moneda: "ARS" } as never)
    await expect(CajaService.update(3, { moneda: "USD" } as never)).rejects.toMatchObject({
      status: 422,
    })
  })

  it("deja cambiar nombre y entidad", async () => {
    repo.findById.mockResolvedValue({ id: 3, moneda: "ARS" } as never)
    repo.update.mockResolvedValue({ id: 3 } as never)
    await CajaService.update(3, { nombre: "Galicia CC" })
    expect(repo.update).toHaveBeenCalledWith(3, { nombre: "Galicia CC" })
  })
})
