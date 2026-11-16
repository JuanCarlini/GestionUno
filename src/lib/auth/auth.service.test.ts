import { describe, it, expect, vi, beforeEach } from "vitest"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { UsuarioRepository } from "@/repositories/usuario.repository"
import { BCRYPT_ROUNDS } from "@/shared/validation/password-validation"
import { AuthService } from "./auth.service"

// El service ya no habla con la base: el I/O vive en UsuarioRepository, y el filtro "solo
// usuarios activos" es parte de la query de findActivoParaLogin / findActivoConRol.
vi.mock("@/repositories/usuario.repository", () => ({
  UsuarioRepository: {
    findActivoParaLogin: vi.fn(),
    findActivoConRol: vi.fn(),
    findHashById: vi.fn(),
    updatePassword: vi.fn(),
  },
}))
vi.mock("@/lib/auth/jwt-secret", () => ({ getJwtSecret: () => "secreto-de-test" }))
vi.mock("bcryptjs", () => ({
  default: {
    // "correcta" es la única clave que matchea; así el test no hashea de verdad.
    compare: vi.fn(async (pw: string) => pw === "correcta"),
    hash: vi.fn(async (pw: string) => "hash(" + pw + ")"),
  },
}))
vi.mock("jsonwebtoken", () => ({
  default: { sign: vi.fn(() => "token-firmado"), verify: vi.fn() },
}))

const repo = vi.mocked(UsuarioRepository)
const bcryptMock = vi.mocked(bcrypt)
const jwtMock = vi.mocked(jwt)

const USUARIO = {
  id: 7,
  email: "juan@obra.com",
  nombre: "Juan",
  password_hash: "$2a$12$hash-real",
  rol_id: 2,
  estado: "activo" as const,
  gu_roles: { nombre: "supervisor" },
}

const PAYLOAD = {
  userId: 7,
  email: "juan@obra.com",
  nombre: "Juan",
  rolId: 2,
  rolNombre: "supervisor",
}

beforeEach(() => {
  vi.clearAllMocks()
  // login, getUserById y changePassword loguean el motivo; no queremos el ruido en la corrida.
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("AuthService.login", () => {
  it("devuelve el usuario y el token, sin el hash de la clave", async () => {
    repo.findActivoParaLogin.mockResolvedValue(USUARIO)

    const res = await AuthService.login("juan@obra.com", "correcta")

    expect(res?.token).toBe("token-firmado")
    expect(res?.user).toEqual({
      id: 7,
      email: "juan@obra.com",
      nombre: "Juan",
      rol_id: 2,
      rol_nombre: "supervisor",
      estado: "activo",
    })
    // El hash nunca sale del service.
    expect(JSON.stringify(res)).not.toContain("hash-real")
    // El "solo activos" es parte del contrato de findActivoParaLogin, no un filtro de acá.
    expect(repo.findActivoParaLogin).toHaveBeenCalledWith("juan@obra.com")
  })

  it("firma el token con el rol en el payload", async () => {
    repo.findActivoParaLogin.mockResolvedValue(USUARIO)
    await AuthService.login("juan@obra.com", "correcta")
    expect(jwtMock.sign).toHaveBeenCalledWith(PAYLOAD, "secreto-de-test", { expiresIn: "7d" })
  })

  // Sin esto, un email registrado responde más lento que uno inexistente y el tiempo de
  // respuesta se vuelve un oráculo de qué cuentas existen.
  it("con un email inexistente compara igual contra un hash de relleno", async () => {
    repo.findActivoParaLogin.mockResolvedValue(null)

    expect(await AuthService.login("nadie@obra.com", "correcta")).toBeNull()
    expect(bcryptMock.compare).toHaveBeenCalledTimes(1)
    expect(String(bcryptMock.compare.mock.calls[0][1])).toContain("$2a$12$")
    expect(jwtMock.sign).not.toHaveBeenCalled()
  })

  it("con la clave incorrecta no emite token", async () => {
    repo.findActivoParaLogin.mockResolvedValue(USUARIO)
    expect(await AuthService.login("juan@obra.com", "incorrecta")).toBeNull()
    expect(jwtMock.sign).not.toHaveBeenCalled()
  })

  it("si estado llega NULL cierra en inactivo (fail-closed)", async () => {
    repo.findActivoParaLogin.mockResolvedValue({ ...USUARIO, estado: null })
    const res = await AuthService.login("juan@obra.com", "correcta")
    expect(res?.user.estado).toBe("inactivo")
  })

  it("si la base explota devuelve null en vez de propagar", async () => {
    repo.findActivoParaLogin.mockRejectedValue(new Error("conexion caida"))
    expect(await AuthService.login("juan@obra.com", "correcta")).toBeNull()
  })
})

describe("AuthService.verifyToken / emitirToken", () => {
  it("devuelve el payload de un token válido", async () => {
    jwtMock.verify.mockReturnValue({ userId: 7 } as never)
    expect(await AuthService.verifyToken("t")).toEqual({ userId: 7 })
  })

  it("devuelve null si el token no verifica", async () => {
    jwtMock.verify.mockImplementation(() => {
      throw new Error("invalid signature")
    })
    expect(await AuthService.verifyToken("t")).toBeNull()
  })

  it("emitirToken firma con los datos del usuario (clave recién cambiada)", () => {
    const token = AuthService.emitirToken({
      id: 7,
      email: "juan@obra.com",
      nombre: "Juan",
      rol_id: 2,
      rol_nombre: "supervisor",
      estado: "activo",
    })
    expect(token).toBe("token-firmado")
    expect(jwtMock.sign).toHaveBeenCalledWith(PAYLOAD, "secreto-de-test", { expiresIn: "7d" })
  })
})

describe("AuthService.getUserById", () => {
  it("trae updated_at, que es lo que invalida las sesiones viejas", async () => {
    repo.findActivoConRol.mockResolvedValue({ ...USUARIO, updated_at: "2026-02-01T10:00:00Z" })

    const user = await AuthService.getUserById(7)

    expect(user).toMatchObject({
      id: 7,
      rol_nombre: "supervisor",
      updated_at: "2026-02-01T10:00:00Z",
    })
    expect(repo.findActivoConRol).toHaveBeenCalledWith(7)
  })

  it("devuelve null si no existe o está inactivo", async () => {
    repo.findActivoConRol.mockResolvedValue(null)
    expect(await AuthService.getUserById(99)).toBeNull()
  })
})

describe("AuthService.changePassword", () => {
  it("rechaza si la clave actual no coincide y no toca la fila", async () => {
    repo.findHashById.mockResolvedValue("$2a$12$x")
    expect(await AuthService.changePassword(7, "incorrecta", "nueva")).toBe(false)
    expect(repo.updatePassword).not.toHaveBeenCalled()
  })

  it("hashea con BCRYPT_ROUNDS y delega el update (que mueve updated_at)", async () => {
    repo.findHashById.mockResolvedValue("$2a$12$x")

    expect(await AuthService.changePassword(7, "correcta", "nueva-clave")).toBe(true)
    expect(bcryptMock.hash).toHaveBeenCalledWith("nueva-clave", BCRYPT_ROUNDS)
    expect(repo.updatePassword).toHaveBeenCalledWith(7, "hash(nueva-clave)")
  })

  it("devuelve false si el update falla", async () => {
    repo.findHashById.mockResolvedValue("$2a$12$x")
    repo.updatePassword.mockRejectedValue(new Error("rls"))
    expect(await AuthService.changePassword(7, "correcta", "nueva")).toBe(false)
  })

  it("devuelve false si el usuario no existe", async () => {
    repo.findHashById.mockResolvedValue(null)
    expect(await AuthService.changePassword(99, "correcta", "nueva")).toBe(false)
    expect(repo.updatePassword).not.toHaveBeenCalled()
  })
})
