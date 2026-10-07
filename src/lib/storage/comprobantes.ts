import { createClient } from "@/lib/supabase/service"
import { HttpError } from "@/lib/route/http-error"

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
async function conTimeout<T>(operacion: Promise<T>): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined
  const vencido = new Promise<never>((_, reject) => {
    reloj = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
  })
  try {
    return await Promise.race([operacion, vencido])
  } finally {
    clearTimeout(reloj)
  }
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

let bucketListo = false

async function asegurarBucket(): Promise<void> {
  if (bucketListo) return
  const storage = createClient().storage
  const { error } = await conTimeout(storage.getBucket(BUCKET))
  if (error) {
    // Bucket PRIVADO: solo se lee con URL firmada que emite esta API después del permiso.
    const creado = await conTimeout(storage.createBucket(BUCKET, { public: false }))
    if (creado.error && !/already exists/i.test(creado.error.message)) throw creado.error
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
      if (/not found|does not exist/i.test(error.message)) return null
      throw error
    }
    return data.signedUrl
  } catch (e) {
    throw servicioCaido(`leer factura ${facturaId}`, e)
  }
}
