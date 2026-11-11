import { describe, it, expect, vi, beforeEach } from "vitest"
import { RolRepository } from "@/repositories/rol.repository"
import { RolService } from "./rol.service"

vi.mock("@/repositories/rol.repository", () => ({
  RolRepository: {
    findAllOrdered: vi.fn(),
    findAllUsuarioRolIds: vi.fn(),
    findById: vi.fn(),
    findByNombre: vi.fn(),
    countUsuariosByRol: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

const repo = vi.mocked(RolRepository)

beforeEach(() => vi.clearAllMocks())

describe("RolService — protección de roles del sistema", () => {
  it("no permite renombrar un rol del sistema", async () => {
    repo.findById.mockResolvedValue({ id: 1, nombre: "admin" })
    await expect(RolService.update(1, { nombre: "superadmin" })).rejects.toThrow(/rol del sistema/)
    expect(repo.update).not.toHaveBeenCalled()
  })

  it("permite editar la descripción de un rol del sistema (mismo nombre)", async () => {
    repo.findById.mockResolvedValue({ id: 1, nombre: "admin" })
    repo.update.mockResolvedValue({ id: 1 })
    await RolService.update(1, { descripcion: "Administrador del sistema" })
    expect(repo.update).toHaveBeenCalledWith(1, { descripcion: "Administrador del sistema" })
  })

  it("no permite borrar un rol del sistema", async () => {
    repo.findById.mockResolvedValue({ id: 2, nombre: "usuario" })
    await expect(RolService.delete(2)).rejects.toThrow(/rol del sistema/)
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it("no borra un rol con usuarios asignados", async () => {
    repo.findById.mockResolvedValue({ id: 5, nombre: "auditor" })
    repo.countUsuariosByRol.mockResolvedValue(3)
    await expect(RolService.delete(5)).rejects.toThrow(/usuario\(s\) asignado/)
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it("borra un rol nuevo sin usuarios asignados", async () => {
    repo.findById.mockResolvedValue({ id: 5, nombre: "auditor" })
    repo.countUsuariosByRol.mockResolvedValue(0)
    repo.delete.mockResolvedValue(undefined)
    expect(await RolService.delete(5)).toBe(true)
    expect(repo.delete).toHaveBeenCalledWith(5)
  })

  it("create rechaza un nombre duplicado", async () => {
    repo.findByNombre.mockResolvedValue({ id: 9 })
    await expect(RolService.create({ nombre: "Auditor" })).rejects.toThrow(/Ya existe/)
    expect(repo.insert).not.toHaveBeenCalled()
  })

  it("getAll marca es_sistema y cuenta usuarios por rol", async () => {
    repo.findAllOrdered.mockResolvedValue([
      { id: 1, nombre: "admin", descripcion: null },
      { id: 5, nombre: "auditor", descripcion: null },
    ])
    repo.findAllUsuarioRolIds.mockResolvedValue([1, 1, 5])

    const res = await RolService.getAll()

    expect(res[0]).toMatchObject({ nombre: "admin", es_sistema: true, usuarios: 2 })
    expect(res[1]).toMatchObject({ nombre: "auditor", es_sistema: false, usuarios: 1 })
  })
})

describe("RolService — validación de permisos (RBAC)", () => {
  it("create rechaza un permiso fuera del catálogo y no persiste", async () => {
    repo.findByNombre.mockResolvedValue(null)
    await expect(
      RolService.create({ nombre: "auditor", permisos: ["ordenes_compra:ver", "fake:accion"] })
    ).rejects.toThrow(/Permiso inválido/)
    expect(repo.insert).not.toHaveBeenCalled()
  })

  it("create persiste un rol con permisos válidos", async () => {
    repo.findByNombre.mockResolvedValue(null)
    repo.insert.mockResolvedValue({ id: 7, nombre: "auditor" })
    await RolService.create({ nombre: "auditor", permisos: ["ordenes_compra:ver"] })
    expect(repo.insert).toHaveBeenCalledWith({
      nombre: "auditor",
      descripcion: null,
      permisos: ["ordenes_compra:ver"],
    })
  })

  it("update rechaza un permiso inválido en un rol no-sistema", async () => {
    repo.findById.mockResolvedValue({ id: 5, nombre: "auditor" })
    await expect(RolService.update(5, { permisos: ["nope:nope"] })).rejects.toThrow(/Permiso inválido/)
    expect(repo.update).not.toHaveBeenCalled()
  })

  it("update ignora los permisos entrantes para el rol admin (anti auto-lockout)", async () => {
    repo.findById.mockResolvedValue({ id: 1, nombre: "admin" })
    repo.update.mockResolvedValue({ id: 1 })
    await RolService.update(1, { permisos: ["ordenes_compra:ver"] })
    // el payload NO incluye permisos para admin
    expect(repo.update).toHaveBeenCalledWith(1, {})
  })
})
