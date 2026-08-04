import { z } from "zod"
import { MONEDAS } from "@/models/enums"

// Sin período explícito, últimos 12 meses. Nunca "todo": una consulta sin cota
// reintroduce el problema de escala que este rediseño elimina.
// En hora LOCAL: con toISOString (UTC), entre las 21:00 y las 00:00 de Argentina el
// rango por defecto corría un día.
function aFechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function haceDoceMeses(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  return aFechaLocal(d)
}

function hoy(): string {
  return aFechaLocal(new Date())
}

export const MONEDA_TODAS = "todas"

const MONEDA_FILTRO = [...MONEDAS, MONEDA_TODAS] as const

export const FiltrosReporteSchema = z
  .object({
    desde: z.string().date().default(haceDoceMeses),
    hasta: z.string().date().default(hoy),
    proveedorId: z.coerce.number().int().positive().nullable().default(null),
    proyectoId: z.coerce.number().int().positive().nullable().default(null),
    moneda: z
      .enum(MONEDA_FILTRO)
      .default("ARS")
      .transform((v) => (v === MONEDA_TODAS ? null : v)),
  })
  .refine((f) => f.desde <= f.hasta, {
    message: "La fecha desde no puede ser posterior a la fecha hasta",
    path: ["desde"],
  })

export type FiltrosReporte = z.infer<typeof FiltrosReporteSchema>
