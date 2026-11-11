import { describe, it, expect, vi, beforeEach } from "vitest"
import { ProveedorRepository } from "@/repositories/proveedor.repository"
import { ProveedorService } from "./proveedor.service"
import { EstadoProveedor } from "@/models"

vi.mock("@/repositories/proveedor.repository", () => ({
  ProveedorRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

const repo = vi.mocked(ProveedorRepository)

beforeEach(() => vi.clearAllMocks())

describe("ProveedorService — normalización y default de estado", () => {
  it("getAll normaliza estado null a 'activo' y respeta el resto", async () => {
    repo.findAll.mockResolvedValue([
      { id: 1, nombre: "A", estado: null },
      { id: 2, nombre: "B", estado: EstadoProveedor.INACTIVO },
    ] as any)

    const res = await ProveedorService.getAll()

    expect(res[0].estado).toBe(EstadoProveedor.ACTIVO)
    expect(res[1].estado).toBe(EstadoProveedor.INACTIVO)
  })

  it("create fuerza estado 'activo' aunque el cliente mande otro (S2)", async () => {
    repo.insert.mockResolvedValue({ id: 1 } as any)
    await ProveedorService.create({ nombre: "X", estado: EstadoProveedor.INACTIVO } as any)
    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ estado: EstadoProveedor.ACTIVO }))
  })

  it("getById normaliza estado null a 'activo'", async () => {
    repo.findById.mockResolvedValue({ id: 1, nombre: "A", estado: null } as any)
    const res = await ProveedorService.getById(1)
    expect(res?.estado).toBe(EstadoProveedor.ACTIVO)
  })

  it("getById devuelve null si el proveedor no existe", async () => {
    repo.findById.mockResolvedValue(null)
    expect(await ProveedorService.getById(99)).toBeNull()
  })
})
