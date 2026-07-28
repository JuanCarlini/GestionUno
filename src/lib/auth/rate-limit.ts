// Rate-limiting de login (anti fuerza bruta). Contador en memoria por instancia: en serverless
// NO es global entre lambdas, es best-effort. Upgrade: @upstash/ratelimit + Vercel KV.

type Intentos = { count: number; resetAt: number }

const MAX_INTENTOS = 5
const VENTANA_MS = 15 * 60 * 1000 // 15 minutos

const store = new Map<string, Intentos>()

/** ¿La clave está bloqueada ahora? No muta nada. */
export function estaBloqueado(key: string, now: number): { bloqueado: boolean; retryAfterSec: number } {
  const rec = store.get(key)
  if (!rec || now > rec.resetAt) return { bloqueado: false, retryAfterSec: 0 }
  if (rec.count >= MAX_INTENTOS) {
    return { bloqueado: true, retryAfterSec: Math.ceil((rec.resetAt - now) / 1000) }
  }
  return { bloqueado: false, retryAfterSec: 0 }
}

/** Registra un intento fallido; abre o extiende la ventana. */
export function registrarFallo(key: string, now: number): void {
  const rec = store.get(key)
  if (!rec || now > rec.resetAt) {
    store.set(key, { count: 1, resetAt: now + VENTANA_MS })
  } else {
    rec.count++
  }
}

/** Login exitoso: limpia el contador de la clave. */
export function limpiarIntentos(key: string): void {
  store.delete(key)
}

/**
 * IP resistente al spoofing de XFF: el PRIMER elemento lo pone el cliente (rotándolo obtenía
 * una clave nueva por intento), así que se usa `x-real-ip` (lo setea la plataforma) o el último salto.
 */
export function resolverIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim()
  if (real) return real

  const saltos = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? []
  return saltos[saltos.length - 1] || "unknown"
}

/**
 * Dos claves: `porEmail` frena de verdad la fuerza bruta contra una cuenta (no depende de
 * headers); `porIpEmail` es best-effort. Costo: un tercero puede bloquear una cuenta (DoS), aceptable.
 */
export function clavesDeLogin(ip: string, email: string): { porEmail: string; porIpEmail: string } {
  const normalizado = String(email).toLowerCase()
  return { porEmail: `email:${normalizado}`, porIpEmail: `${ip}:${normalizado}` }
}
