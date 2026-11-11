import { describe, it, expect } from "vitest"
import { estaBloqueado, registrarFallo, limpiarIntentos, resolverIp, clavesDeLogin } from "./rate-limit"

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

// El store del limiter es module-level; cada test usa una clave única para aislarse.
describe("rate-limit de login (S3)", () => {
  const now = 1_000_000

  it("deja pasar los primeros 5 intentos y bloquea el 6º", () => {
    const key = "ip1:user@a.com"
    for (let i = 0; i < 5; i++) {
      expect(estaBloqueado(key, now).bloqueado).toBe(false)
      registrarFallo(key, now)
    }
    const r = estaBloqueado(key, now)
    expect(r.bloqueado).toBe(true)
    expect(r.retryAfterSec).toBeGreaterThan(0)
  })

  it("un login exitoso limpia el contador", () => {
    const key = "ip2:user@a.com"
    for (let i = 0; i < 5; i++) registrarFallo(key, now)
    expect(estaBloqueado(key, now).bloqueado).toBe(true)
    limpiarIntentos(key)
    expect(estaBloqueado(key, now).bloqueado).toBe(false)
  })

  it("la ventana expira: pasados 15 min el bloqueo se levanta", () => {
    const key = "ip3:user@a.com"
    for (let i = 0; i < 5; i++) registrarFallo(key, now)
    expect(estaBloqueado(key, now).bloqueado).toBe(true)
    const despues = now + 15 * 60 * 1000 + 1
    expect(estaBloqueado(key, despues).bloqueado).toBe(false)
  })

  it("claves distintas (otro IP/email) no se afectan entre sí", () => {
    const a = "ipA:x@a.com"
    const b = "ipB:x@a.com"
    for (let i = 0; i < 5; i++) registrarFallo(a, now)
    expect(estaBloqueado(a, now).bloqueado).toBe(true)
    expect(estaBloqueado(b, now).bloqueado).toBe(false)
  })
})
