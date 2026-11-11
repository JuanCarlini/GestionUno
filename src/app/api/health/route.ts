import { NextResponse } from "next/server"
import { SaludRepository } from "@/repositories/salud.repository"
import { pingStorage } from "@/lib/storage/comprobantes"
import { conTimeout } from "@/shared/con-timeout"

// GET /api/health — público y sin datos sensibles. Lo consume el monitoreo sintético
// (.github/workflows/monitor.yml) y cualquier chequeo externo.
//
// Público a propósito: un health check que pide credenciales no sirve para monitorear desde
// afuera. Por eso la respuesta NO dice nada que no se pueda publicar: ni mensajes de error de
// la base, ni nombres de host, ni versiones de dependencias. Solo "anda / no anda" por
// dependencia, y el sha del commit desplegado, que es público en el repo.
export const dynamic = "force-dynamic"

const TIMEOUT_MS = 3000

// Vercel la expone en el build. En local no existe: no se inventa un valor.
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA ?? "local"

type Estado = "ok" | "error"

async function chequear(nombre: string, operacion: () => Promise<void>): Promise<Estado> {
  try {
    await conTimeout(operacion(), TIMEOUT_MS)
    return "ok"
  } catch (e) {
    // El detalle va al log, que es donde se diagnostica; afuera solo "error".
    console.error(`[health] ${nombre}:`, e)
    return "error"
  }
}

export async function GET() {
  // En paralelo: el presupuesto de la ruta es un timeout, no dos sumados.
  const [db, storage] = await Promise.all([
    chequear("db", () => SaludRepository.pingBase()),
    chequear("storage", () => pingStorage(TIMEOUT_MS)),
  ])

  const ok = db === "ok" && storage === "ok"

  return NextResponse.json(
    { ok, db, storage, version: VERSION },
    {
      // 503 y no 200-con-ok-false: el monitoreo tiene que poder decidir por el status, sin
      // parsear el cuerpo.
      status: ok ? 200 : 503,
      // Nunca cacheado: un health check cacheado reporta el pasado.
      headers: { "Cache-Control": "no-store" },
    }
  )
}
