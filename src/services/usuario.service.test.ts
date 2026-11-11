import { BCRYPT_ROUNDS } from "@/shared/validation/password-validation"
import { describe, it, expect, vi, beforeEach } from "vitest"
import bcrypt from "bcryptjs"
import { UsuarioRepository } from "@/repositories/usuario.repository"
import { RolRepository } from "@/repositories/rol.repository"
import { UsuarioService } from "./usuario.service"

vi.mock("@/repositories/usuario.repository", () => ({
  UsuarioRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    updatePassword: vi.fn(),
  },
}))
vi.mock("@/repositories/rol.repository", () => ({
  RolRepository: {
    findByNombre: vi.fn(),
  },
}))
// bcrypt mockeado: determinístico y rápido (no queremos hashear de verdad en el test).
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(async (pw: string) => `hash(${pw})`) },
}))

const repo = vi.mocked(UsuarioRepository)
const rolRepo = vi.mocked(RolRepository)
const bcryptMock = vi.mocked(bcrypt)

beforeEach(() => vi.clearAllMocks())

describe("UsuarioService.create", () => {
  it("rechaza si el email ya está registrado (no inserta)", async () => {
    repo.findByEmail.mockResolvedValue({ id: 1 })
    await expect(
      UsuarioService.create({ nombre: "A", email: "a@b.com", password: "x", rol_id: 2 })
    ).rejects.toThrow(/email ya está registrado/)
    expect(repo.insert).not.toHaveBeenCalled()
  })

  it("hashea la clave e inserta con estado 'activo'", async () => {
    repo.findByEmail.mockResolvedValue(null)
    repo.insert.mockResolvedValue({ id: 1 })

    await UsuarioService.create({ nombre: "A", email: "a@b.com", password: "secreto", rol_id: 3 })

    expect(bcryptMock.hash).toHaveBeenCalledWith("secreto", BCRYPT_ROUNDS)
    expect(repo.insert).toHaveBeenCalledWith({
      nombre: "A",
      email: "a@b.com",
      password_hash: "hash(secreto)",
      rol_id: 3,
      estado: "activo",
    })
  })
})

describe("UsuarioService.resetPassword", () => {
  it("hashea la nueva clave y la persiste vía updatePassword", async () => {
    repo.updatePassword.mockResolvedValue(undefined)

    const ok = await UsuarioService.resetPassword(5, "nueva")

    expect(bcryptMock.hash).toHaveBeenCalledWith("nueva", BCRYPT_ROUNDS)
    expect(repo.updatePassword).toHaveBeenCalledWith(5, "hash(nueva)")
    expect(ok).toBe(true)
  })
})

describe("UsuarioService.updateRol", () => {
  it("asigna un rol custom (no-sistema) que existe en gu_roles", async () => {
    repo.findById.mockResolvedValue({ id: 7, email: "a@b.com", gu_roles: { nombre: "usuario" } })
    rolRepo.findByNombre.mockResolvedValue({ id: 5 })
    repo.update.mockResolvedValue({ id: 7 })

    const res = await UsuarioService.updateRol(7, "compras", { id: 1 })

    expect(rolRepo.findByNombre).toHaveBeenCalledWith("compras")
    expect(repo.update).toHaveBeenCalledWith(7, { rol_id: 5 })
    expect(res.rol).toBe("compras")
  })

  it("404 si el usuario no existe", async () => {
    repo.findById.mockResolvedValue(null)
    await expect(
      UsuarioService.updateRol(1, "supervisor", { id: 99 })
    ).rejects.toMatchObject({ status: 404 })
    expect(repo.update).not.toHaveBeenCalled()
  })

  it("impide que un admin se quite a sí mismo el rol admin (anti auto-lockout)", async () => {
    repo.findById.mockResolvedValue({ id: 7, email: "a@b.com", gu_roles: { nombre: "admin" } })
    await expect(
      UsuarioService.updateRol(7, "usuario", { id: 7 })
    ).rejects.toMatchObject({ status: 400 })
    expect(repo.update).not.toHaveBeenCalled()
  })

  it("404 si el rol destino no existe en gu_roles", async () => {
    repo.findById.mockResolvedValue({ id: 7, email: "a@b.com", gu_roles: { nombre: "usuario" } })
    rolRepo.findByNombre.mockResolvedValue(null)
    await expect(
      UsuarioService.updateRol(7, "supervisor", { id: 1 })
    ).rejects.toMatchObject({ status: 404 })
    expect(repo.update).not.toHaveBeenCalled()
  })

  it("cambia el rol: resuelve el rol_id y actualiza el usuario", async () => {
    repo.findById.mockResolvedValue({ id: 7, email: "a@b.com", gu_roles: { nombre: "usuario" } })
    rolRepo.findByNombre.mockResolvedValue({ id: 3 })
    repo.update.mockResolvedValue({ id: 7 })

    const res = await UsuarioService.updateRol(7, "supervisor", { id: 1 })

    expect(rolRepo.findByNombre).toHaveBeenCalledWith("supervisor")
    expect(repo.update).toHaveBeenCalledWith(7, { rol_id: 3 })
    expect(res).toEqual({ id: 7, email: "a@b.com", rol: "supervisor" })
  })
})

describe("UsuarioService.update (anti auto-lockout)", () => {
  it("impide que un admin se desactive a sí mismo", async () => {
    await expect(
      UsuarioService.update(7, { estado: "inactivo" }, { id: 7 })
    ).rejects.toMatchObject({ status: 400 })
    expect(repo.update).not.toHaveBeenCalled()
  })

  it("impide que un admin se quite el rol admin a sí mismo (rol_id != 1)", async () => {
    await expect(
      UsuarioService.update(7, { rol_id: 2 }, { id: 7 })
    ).rejects.toMatchObject({ status: 400 })
    expect(repo.update).not.toHaveBeenCalled()
  })

  it("permite editarse a sí mismo si mantiene el rol admin (rol_id = 1)", async () => {
    repo.update.mockResolvedValue({ id: 7 })
    await UsuarioService.update(7, { rol_id: 1, nombre: "Yo" }, { id: 7 })
    expect(repo.update).toHaveBeenCalled()
  })

  it("permite a un admin desactivar a OTRO usuario", async () => {
    repo.update.mockResolvedValue({ id: 9 })
    await UsuarioService.update(9, { estado: "inactivo" }, { id: 7 })
    expect(repo.update).toHaveBeenCalledWith(9, expect.objectContaining({ estado: "inactivo" }))
  })

  it("sin actor no aplica la guarda (compatibilidad)", async () => {
    repo.update.mockResolvedValue({ id: 7 })
    await UsuarioService.update(7, { estado: "inactivo" })
    expect(repo.update).toHaveBeenCalled()
  })
})

describe("UsuarioService.baja (anti auto-baja)", () => {
  it("impide que un admin se dé de baja a sí mismo", async () => {
    await expect(UsuarioService.baja(7, { id: 7 })).rejects.toMatchObject({ status: 400 })
    expect(repo.update).not.toHaveBeenCalled()
  })

  it("da de baja a otro usuario (estado inactivo)", async () => {
    repo.update.mockResolvedValue({ id: 9 })
    await UsuarioService.baja(9, { id: 7 })
    expect(repo.update).toHaveBeenCalledWith(9, { estado: "inactivo" })
  })
})
