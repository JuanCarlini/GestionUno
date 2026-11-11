import { createClient } from "@/lib/supabase/service"
import { HttpError } from "@/lib/route/http-error"
import { conTimeout as correrConTimeout } from "@/shared/con-timeout"

// Integración externa: Supabase Storage guarda el PDF del comprobante que manda el proveedor.
// El archivo NO es parte del circuito: la factura existe y avanza (finalizar, pagar) tenga o no
// el PDF. Por eso, si el servicio no responde, se corta rápido y se responde 503 — la factura
// queda intacta y el usuario reintenta la subida. Nunca se bloquea el flujo por un adjunto.

const BUCKET = "comprobantes"
const TIMEOUT_MS = 8000
export const MAX_BYTES = 4 * 1024 * 1024 // Vercel corta los bodies en ~4.5 MB

const rutaDe = (facturaId: number) => `facturas/${facturaId}.pdf`

// El SDK no tiene timeout propio: si Storage se cuelga, la request quedaría colgada hasta que
// Vercel la mate (y el usuario sin respuesta). Se corre contra un reloj de 8 s.
const conTimeout = <T,>(operacion: Promise<T>) => correrConTimeout(operacion, TIMEOUT_MS)

/**
 * Chequeo de vida de Storage para /api/health, con su propia ventana (el health check corta
 * mucho antes que una subida). Devuelve void o tira: el formato de la respuesta lo arma la ruta.
 */
export async function pingStorage(ms: number): Promise<void> {
  const { error } = await correrConTimeout(createClient().storage.getBucket(BUCKET), ms)
  if (error) throw error
}

// Toda falla del proveedor externo (timeout, red, 5xx de Storage) se traduce a UN 503: es
// transitoria y no es culpa del cliente. El detalle técnico va al log, no a la respuesta.
function servicioCaido(contexto: string, causa: unknown): HttpError {
  console.error(`[storage] ${contexto}:`, causa)
  return new HttpError(
    503,
    "El servicio de archivos no responde. La factura quedó guardada sin cambios; reintentá en unos minutos."
  )
}

// El SDK de Storage trae el código HTTP del error en `status` (number) y, según la versión,
// también en `statusCode` (string). Decidir por el MENSAJE era frágil en los dos sentidos: un
// cambio de wording del lado de Supabase convierte un "no existe" en 503, y un mensaje de otro
// error que casualmente diga "not found" se traga como "la factura no tiene PDF".
function codigoDe(error: unknown): number | undefined {
  const e = error as { status?: unknown; statusCode?: unknown } | null
  const crudo = e?.status ?? e?.statusCode
  const n = typeof crudo === "string" ? Number(crudo) : crudo
  return typeof n === "number" && Number.isFinite(n) ? n : undefined
}

// `respaldo` es la regex que se usaba antes. Queda solo para cuando el error no trae código:
// un error de red envuelto, o una versión del SDK que no lo exponga.
function esCodigo(error: unknown, codigo: number, respaldo: RegExp): boolean {
  const c = codigoDe(error)
  if (c !== undefined) return c === codigo
  return respaldo.test((error as { message?: string } | null)?.message ?? "")
}

let bucketListo = false

async function asegurarBucket(): Promise<void> {
  if (bucketListo) return
  const storage = createClient().storage
  const { error } = await conTimeout(storage.getBucket(BUCKET))
  if (error) {
    // Bucket PRIVADO: solo se lee con URL firmada que emite esta API después del permiso.
    const creado = await conTimeout(storage.createBucket(BUCKET, { public: false }))
    // 409: otra request lo creó primero. Cualquier otro error sí es una falla real.
    if (creado.error && !esCodigo(creado.error, 409, /already exists/i)) throw creado.error
  }
  bucketListo = true
}

export async function subirComprobante(facturaId: number, archivo: ArrayBuffer): Promise<void> {
  try {
    await asegurarBucket()
    const { error } = await conTimeout(
      createClient()
        .storage.from(BUCKET)
        .upload(rutaDe(facturaId), archivo, { contentType: "application/pdf", upsert: true })
    )
    if (error) throw error
  } catch (e) {
    throw servicioCaido(`subir factura ${facturaId}`, e)
  }
}

// URL firmada de 5 minutos, o null si la factura todavía no tiene PDF.
export async function urlComprobante(facturaId: number): Promise<string | null> {
  try {
    await asegurarBucket()
    const { data, error } = await conTimeout(
      createClient().storage.from(BUCKET).createSignedUrl(rutaDe(facturaId), 300)
    )
    if (error) {
      // 404: la factura todavía no tiene PDF, que es un caso normal y no un fallo.
      if (esCodigo(error, 404, /not found|does not exist/i)) return null
      throw error
    }
    return data.signedUrl
  } catch (e) {
    throw servicioCaido(`leer factura ${facturaId}`, e)
  }
}
