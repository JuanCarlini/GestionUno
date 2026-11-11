import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Rate-limiting de login (anti fuerza bruta).
//
// El contador vivía en un Map en memoria. En Vercel cada lambda tiene el suyo, así que el
// límite real no era "5 intentos cada 15 minutos" sino "5 intentos por instancia": con el
// tráfico repartido entre N lambdas, un atacante tenía 5N intentos, y cada despliegue o cada
// lambda que escala de cero reseteaba el contador. Ahora el contador es compartido (Upstash
// Redis) y el Map queda como respaldo para desarrollo y para el caso en que las variables no
// estén configuradas: mejor un límite best-effort que ninguno.

const MAX_INTENTOS = 5
const VENTANA_MS = 15 * 60 * 1000 // 15 minutos
const VENTANA = "15 m" as const // la misma ventana, en el formato de @upstash/ratelimit

export interface EstadoBloqueo {
  bloqueado: boolean
  retryAfterSec: number
}

// Los dos backends exponen lo mismo; la ruta de login no sabe cuál está activo.
interface Backend {
  estaBloqueado(key: string, now: number): Promise<EstadoBloqueo>
  registrarFallo(key: string, now: number): Promise<void>
  limpiarIntentos(key: string): Promise<void>
}

// ------------------------------------------------------------------ respaldo en memoria
type Intentos = { count: number; resetAt: number }

function backendEnMemoria(): Backend {
  const store = new Map<string, Intentos>()

  return {
    async estaBloqueado(key, now) {
      const rec = store.get(key)
      if (!rec || now > rec.resetAt) return { bloqueado: false, retryAfterSec: 0 }
      if (rec.count >= MAX_INTENTOS) {
        return { bloqueado: true, retryAfterSec: Math.ceil((rec.resetAt - now) / 1000) }
      }
      return { bloqueado: false, retryAfterSec: 0 }
    },

    async registrarFallo(key, now) {
      const rec = store.get(key)
      if (!rec || now > rec.resetAt) {
        store.set(key, { count: 1, resetAt: now + VENTANA_MS })
      } else {
        rec.count++
      }
    },

    async limpiarIntentos(key) {
      store.delete(key)
    },
  }
}

// ------------------------------------------------------------------ Upstash Redis
export function backendUpstash(url: string, token: string): Backend {
  // fixedWindow y no slidingWindow: es la ventana que ya tenía el Map (5 intentos, se abre con
  // el primer fallo y se cierra 15 minutos después), y así el comportamiento no cambia al
  // activar Redis. Una ventana deslizante sería más estricta, pero es otra decisión.
  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(MAX_INTENTOS, VENTANA),
    prefix: "gu:login",
  })

  return {
    // getRemaining NO consume: el chequeo previo al login no puede contar como intento, si no
    // un usuario con la clave correcta se bloquearía solo.
    async estaBloqueado(key, now) {
      const { remaining, reset } = await limiter.getRemaining(key)
      if (remaining > 0) return { bloqueado: false, retryAfterSec: 0 }
      return { bloqueado: true, retryAfterSec: Math.max(1, Math.ceil((reset - now) / 1000)) }
    },

    // Acá sí se consume un token: un intento fallido es lo que mueve el contador.
    async registrarFallo(key) {
      await limiter.limit(key)
    },

    async limpiarIntentos(key) {
      await limiter.resetUsedTokens(key)
    },
  }
}

// ------------------------------------------------------------------ elección del backend
function elegirBackend(): Backend {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) return backendUpstash(url, token)

  // No se tira: sin Redis el login tiene que seguir funcionando. Pero queda dicho en el log,
  // porque en producción esto significa que el límite es por instancia.
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN no configuradas: " +
      "el contador de intentos de login queda en memoria y NO se comparte entre instancias."
  )
  return backendEnMemoria()
}

let backend: Backend | undefined

function activo(): Backend {
  backend ??= elegirBackend()
  return backend
}

/** ¿La clave está bloqueada ahora? No consume intentos. */
export function estaBloqueado(key: string, now: number): Promise<EstadoBloqueo> {
  return activo().estaBloqueado(key, now)
}

/** Registra un intento fallido; abre o extiende la ventana. */
export function registrarFallo(key: string, now: number): Promise<void> {
  return activo().registrarFallo(key, now)
}

/** Login exitoso: limpia el contador de la clave. */
export function limpiarIntentos(key: string): Promise<void> {
  return activo().limpiarIntentos(key)
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
