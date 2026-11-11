import { describe, it, expect, vi } from "vitest"
import {
  estaBloqueado,
  registrarFallo,
  limpiarIntentos,
  resolverIp,
  clavesDeLogin,
  backendUpstash,
} from "./rate-limit"

// Upstash mockeado: no queremos tocar la red, y lo que importa es QUE se llama y con qué.
// vi.hoisted porque vitest iza los vi.mock arriba del archivo: un const normal todavía no
// existe cuando corre la factory.
const up = vi.hoisted(() => ({
  limit: vi.fn(async () => ({ success: true })),
  getRemaining: vi.fn(async () => ({ remaining: 5, reset: 0, limit: 5 })),
  resetUsedTokens: vi.fn(async () => {}),
  fixedWindow: vi.fn((intentos: number, ventana: string) => ({ intentos, ventana })),
  configRedis: vi.fn(),
}))

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static fixedWindow = up.fixedWindow
    limit = up.limit
    getRemaining = up.getRemaining
    resetUsedTokens = up.resetUsedTokens
  },
}))
vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(cfg: unknown) {
      up.configRedis(cfg)
    }
  },
}))

// CN-006: la clave del contador se armaba con el PRIMER elemento de x-forwarded-for, que es
// justamente la parte que controla el cliente (el proxy AGREGA su valor observado, no lo
// reemplaza en la primera posición). Rotando el header en cada request el contador nunca
// llegaba a 5 y el bloqueo no se disparaba nunca: fuerza bruta ilimitada.
describe("resolverIp (anti-spoofing de X-Forwarded-For)", () => {
  const h = (o: Record<string, string>) => new Headers(o)

  it("prefiere x-real-ip, que lo setea la plataforma y el cliente no puede falsificar", () => {
    expect(resolverIp(h({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("203.0.113.9")
  })

  it("sin x-real-ip usa el ÚLTIMO salto del XFF, no el primero", () => {
    // El primero lo puso el cliente; el último lo agregó el proxy de confianza.
    expect(resolverIp(h({ "x-forwarded-for": "9.9.9.9, 10.0.0.1, 203.0.113.9" }))).toBe("203.0.113.9")
  })

  it("un XFF falsificado con un solo valor no se puede distinguir, pero no rompe", () => {
    expect(resolverIp(h({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4")
  })

  it("sin ningún header devuelve 'unknown'", () => {
    expect(resolverIp(h({}))).toBe("unknown")
  })
})

describe("clavesDeLogin", () => {
  it("devuelve una clave por EMAIL además de la de ip+email", () => {
    const { porEmail, porIpEmail } = clavesDeLogin("1.2.3.4", "User@A.com")
    // La de email es la que de verdad frena: no depende de un header falsificable.
    expect(porEmail).toBe("email:user@a.com")
    expect(porIpEmail).toBe("1.2.3.4:user@a.com")
  })

  it("normaliza el email a minúsculas para que no se evada cambiando el case", () => {
    expect(clavesDeLogin("ip", "ADMIN@X.COM").porEmail).toBe(clavesDeLogin("ip", "admin@x.com").porEmail)
  })
})

// Sin UPSTASH_REDIS_REST_URL / _TOKEN el limiter cae al respaldo en memoria, que es lo que se
// prueba acá: mismo comportamiento que tenía antes de que el contador fuera compartido. El
// store es module-level, así que cada test usa una clave única para aislarse.
describe("rate-limit de login — respaldo en memoria (S3)", () => {
  const now = 1_000_000

  it("deja pasar los primeros 5 intentos y bloquea el 6º", async () => {
    const key = "ip1:user@a.com"
    for (let i = 0; i < 5; i++) {
      expect((await estaBloqueado(key, now)).bloqueado).toBe(false)
      await registrarFallo(key, now)
    }
    const r = await estaBloqueado(key, now)
    expect(r.bloqueado).toBe(true)
    expect(r.retryAfterSec).toBeGreaterThan(0)
  })

  it("un login exitoso limpia el contador", async () => {
    const key = "ip2:user@a.com"
    for (let i = 0; i < 5; i++) await registrarFallo(key, now)
    expect((await estaBloqueado(key, now)).bloqueado).toBe(true)
    await limpiarIntentos(key)
    expect((await estaBloqueado(key, now)).bloqueado).toBe(false)
  })

  it("la ventana expira: pasados 15 min el bloqueo se levanta", async () => {
    const key = "ip3:user@a.com"
    for (let i = 0; i < 5; i++) await registrarFallo(key, now)
    expect((await estaBloqueado(key, now)).bloqueado).toBe(true)
    const despues = now + 15 * 60 * 1000 + 1
    expect((await estaBloqueado(key, despues)).bloqueado).toBe(false)
  })

  it("claves distintas (otro IP/email) no se afectan entre sí", async () => {
    const a = "ipA:x@a.com"
    const b = "ipB:x@a.com"
    for (let i = 0; i < 5; i++) await registrarFallo(a, now)
    expect((await estaBloqueado(a, now)).bloqueado).toBe(true)
    expect((await estaBloqueado(b, now)).bloqueado).toBe(false)
  })
})

// Con las variables configuradas el contador vive en Redis y lo comparten todas las lambdas,
// que es el punto: en memoria el limite real era "5 intentos POR INSTANCIA".
describe("rate-limit de login — backend Upstash", () => {
  const now = 1_000_000

  it("usa una ventana fija de 5 intentos / 15 minutos, la misma que tenía en memoria", () => {
    backendUpstash("https://redis.upstash.io", "token")
    expect(up.fixedWindow).toHaveBeenCalledWith(5, "15 m")
    expect(up.configRedis).toHaveBeenCalledWith({ url: "https://redis.upstash.io", token: "token" })
  })

  it("con intentos disponibles no bloquea", async () => {
    up.getRemaining.mockResolvedValue({ remaining: 3, reset: now + 60_000, limit: 5 })
    const backend = backendUpstash("https://u", "t")
    expect(await backend.estaBloqueado("k", now)).toEqual({ bloqueado: false, retryAfterSec: 0 })
  })

  it("sin intentos disponibles bloquea y calcula el Retry-After desde el reset", async () => {
    up.getRemaining.mockResolvedValue({ remaining: 0, reset: now + 90_000, limit: 5 })
    const backend = backendUpstash("https://u", "t")
    expect(await backend.estaBloqueado("k", now)).toEqual({ bloqueado: true, retryAfterSec: 90 })
  })

  // El chequeo previo al login no puede consumir un intento: si consumiera, un usuario con la
  // clave correcta se bloquearía solo a los 5 logins.
  it("el chequeo NO consume intentos", async () => {
    up.limit.mockClear()
    up.getRemaining.mockResolvedValue({ remaining: 5, reset: now, limit: 5 })
    const backend = backendUpstash("https://u", "t")
    await backend.estaBloqueado("k", now)
    expect(up.limit).not.toHaveBeenCalled()
  })

  it("el fallo consume un intento y el login exitoso limpia la clave", async () => {
    const backend = backendUpstash("https://u", "t")
    await backend.registrarFallo("k", now)
    expect(up.limit).toHaveBeenCalledWith("k")
    await backend.limpiarIntentos("k")
    expect(up.resetUsedTokens).toHaveBeenCalledWith("k")
  })
})
