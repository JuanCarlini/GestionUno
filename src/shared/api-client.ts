import type { CodigoError } from "@/lib/route/respuesta-error"
import type { CuerpoPaginado } from "@/lib/route/paginacion"

// Wrapper de fetch del cliente (el browser no habla con Supabase: RLS niega anon). Lo usan
// los hooks de lista; los formularios todavía hacen fetch a mano — deuda de consistencia —
// pero leen el cuerpo de error con los helpers de abajo, así la forma del error vive en un
// solo lugar.

// El cuerpo de error de la API es { error: { codigo, mensaje, detalles? } } (ver
// lib/route/respuesta-error.ts).
interface CuerpoError {
  error?: { codigo?: CodigoError; mensaje?: string; detalles?: unknown }
}

/** El mensaje de un cuerpo de error, o `porDefecto` si la respuesta no tiene el formato. */
export function mensajeDeError(body: unknown, porDefecto: string): string {
  return (body as CuerpoError)?.error?.mensaje || porDefecto
}

/** El código estable, para ramificar sin comparar mensajes. */
export function codigoDeError(body: unknown): CodigoError | undefined {
  return (body as CuerpoError)?.error?.codigo
}

/**
 * Error de la API con el código y los detalles a mano. Extiende Error, así que todo lo que ya
 * mostraba `e.message` en un toast sigue funcionando igual.
 */
export class ApiError extends Error {
  constructor(
    mensaje: string,
    public readonly status: number,
    public readonly codigo?: CodigoError,
    public readonly detalles?: unknown
  ) {
    super(mensaje)
    this.name = "ApiError"
  }

  /** Otro usuario tocó el documento primero: la UI tiene que recargar antes de reintentar. */
  get esConflicto(): boolean {
    return this.codigo === "CONFLICTO"
  }
}

export async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(
      mensajeDeError(body, `Error ${res.status}`),
      res.status,
      codigoDeError(body),
      (body as CuerpoError)?.error?.detalles
    )
  }
  return res.json()
}

/**
 * Filas de un listado paginado. Los listados del circuito responden
 * `{ data, total, page, limit, next }` (lib/route/paginacion.ts), NO un array: cuando se
 * agregó la paginación en el servidor, los cuatro formularios siguieron leyendo la respuesta
 * como si fuera un array y `data.filter(...)` tiraba TypeError, así que el selector quedaba
 * vacío y la pantalla mostraba "No hay proveedores disponibles" con la base llena. Los tests
 * no lo vieron porque el e2e recorre el circuito por API y nunca abre los formularios.
 *
 * Los filtros van en la query y no acá: el tope del servidor es LIMITE_MAXIMO (100), así que
 * filtrar del lado del browser una sola página esconde opciones válidas.
 */
export async function listado<T>(path: string): Promise<T[]> {
  const cuerpo = (await api(path)) as CuerpoPaginado<T>
  return cuerpo?.data ?? []
}
