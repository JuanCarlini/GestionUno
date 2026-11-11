import { describe, it, expect, vi, beforeEach } from "vitest"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { createClient } from "@/lib/supabase/service"
import { BCRYPT_ROUNDS } from "@/shared/validation/password-validation"
import { AuthService } from "./auth.service"

vi.mock("@/lib/supabase/service", () => ({ createClient: vi.fn() }))
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

const bcryptMock = vi.mocked(bcrypt)
const jwtMock = vi.mocked(jwt)

// Cliente Supabase falso: builder encadenable que registra las llamadas. El single() resuelve
// el resultado del select y el update().eq() el del update.
function mockClient(res: { select?: unknown; update?: unknown } = {}) {
  const calls: Record<string, unknown[]> = { from: [], select: [], eq: [], update: [] }
  const b: Record<string, unknown> = {
    from: (t: string) => (calls.from.push(t), b),
    select: (s: string) => (calls.select.push(s), b),
    eq: (c: string, v: unknown) => (calls.eq.push([c, v]), b),
    update: (row: unknown) => {
      calls.update.push(row)
      return {
        eq: (c: string, v: unknown) => (
          calls.eq.push([c, v]), Promise.resolve(res.update ?? { error: null })
        ),
      }
    },
    single: () => Promise.resolve(res.select ?? { data: null, error: null }),
  }
  vi.mocked(createClient).mockReturnValue(b as never)
  return calls
}

const USUARIO = {
  id: 7,
  email: "juan@obra.com",
  nombre: "Juan",
  password_hash: "$2a$12$hash-real",
  rol_id: 2,
  estado: "activo",
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
    const calls = mockClient({ select: { data: USUARIO, error: null } })

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
    // Solo usuarios activos, y por email exacto.
    expect(calls.from).toEqual(["gu_usuario"])
    expect(calls.eq).toEqual([
      ["email", "juan@obra.com"],
      ["estado", "activo"],
    ])
  })

  it("firma el token con el rol en el payload", async () => {
    mockClient({ select: { data: USUARIO, error: null } })
    await AuthService.login("juan@obra.com", "correcta")
    expect(jwtMock.sign).toHaveBeenCalledWith(PAYLOAD, "secreto-de-test", { expiresIn: "7d" })
  })

  // Sin esto, un email registrado responde más lento que uno inexistente y el tiempo de
  // respuesta se vuelve un oráculo de qué cuentas existen.
  it("con un email inexistente compara igual contra un hash de relleno", async () => {
    mockClient({ select: { data: null, error: { message: "no rows" } } })

    expect(await AuthService.login("nadie@obra.com", "correcta")).toBeNull()
    expect(bcryptMock.compare).toHaveBeenCalledTimes(1)
    expect(String(bcryptMock.compare.mock.calls[0][1])).toContain("$2a$12$")
    expect(jwtMock.sign).not.toHaveBeenCalled()
  })

  it("con la clave incorrecta no emite token", async () => {
    mockClient({ select: { data: USUARIO, error: null } })
    expect(await AuthService.login("juan@obra.com", "incorrecta")).toBeNull()
    expect(jwtMock.sign).not.toHaveBeenCalled()
  })

  it("si estado llega NULL cierra en inactivo (fail-closed)", async () => {
    mockClient({ select: { data: { ...USUARIO, estado: null }, error: null } })
    const res = await AuthService.login("juan@obra.com", "correcta")
    expect(res?.user.estado).toBe("inactivo")
  })

  it("si la base explota devuelve null en vez de propagar", async () => {
    vi.mocked(createClient).mockImplementation(() => {
      throw new Error("conexion caida")
    })
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
  it("trae updated_at (lo necesita la invalidación de sesiones) y filtra por activo", async () => {
    const calls = mockClient({
      select: { data: { ...USUARIO, updated_at: "2026-02-01T10:00:00Z" }, error: null },
    })

    const user = await AuthService.getUserById(7)

    expect(user).toMatchObject({
      id: 7,
      rol_nombre: "supervisor",
      updated_at: "2026-02-01T10:00:00Z",
    })
    expect(calls.eq).toEqual([
      ["id", 7],
      ["estado", "activo"],
    ])
  })

  it("devuelve null si no existe o está inactivo", async () => {
    mockClient({ select: { data: null, error: { message: "no rows" } } })
    expect(await AuthService.getUserById(99)).toBeNull()
  })
})

describe("AuthService.changePassword", () => {
  it("rechaza si la clave actual no coincide y no toca la fila", async () => {
    const calls = mockClient({ select: { data: { password_hash: "$2a$12$x" }, error: null } })
    expect(await AuthService.changePassword(7, "incorrecta", "nueva")).toBe(false)
    expect(calls.update).toEqual([])
  })

  it("hashea con BCRYPT_ROUNDS y mueve updated_at (invalida las sesiones viejas)", async () => {
    const calls = mockClient({ select: { data: { password_hash: "$2a$12$x" }, error: null } })

    expect(await AuthService.changePassword(7, "correcta", "nueva-clave")).toBe(true)
    expect(bcryptMock.hash).toHaveBeenCalledWith("nueva-clave", BCRYPT_ROUNDS)

    const update = calls.update[0] as { password_hash: string; updated_at: string }
    expect(update.password_hash).toBe("hash(nueva-clave)")
    expect(Number.isNaN(Date.parse(update.updated_at))).toBe(false)
  })

  it("devuelve false si el update falla", async () => {
    mockClient({
      select: { data: { password_hash: "$2a$12$x" }, error: null },
      update: { error: { message: "rls" } },
    })
    expect(await AuthService.changePassword(7, "correcta", "nueva")).toBe(false)
  })

  it("devuelve false si el usuario no existe", async () => {
    const calls = mockClient({ select: { data: null, error: { message: "no rows" } } })
    expect(await AuthService.changePassword(99, "correcta", "nueva")).toBe(false)
    expect(calls.update).toEqual([])
  })
})
