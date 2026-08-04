import { z } from "zod"

// Whitelist de campos para crear un proyecto. `estado` se OMITE a propósito: lo pone el
// default de la DB, no el cliente (anti mass-assignment); Zod descarta los campos extra.
export const PROYECTO_ESTADOS = ["planificado", "en_ejecucion", "finalizado", "cancelado"] as const

export const LABEL_PROYECTO_ESTADO: Record<(typeof PROYECTO_ESTADOS)[number], string> = {
  planificado: "Planificado",
  en_ejecucion: "En ejecución",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
}

// El form manda "" cuando la fecha está vacía; a la DB tiene que llegar undefined (columna
// date con default null), y una fecha malformada se rechaza acá con 400, no con un 500 de DB.
const FechaOpcional = z
  .string()
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.string().date("Fecha inválida (AAAA-MM-DD)").optional())

export const CreateProyectoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  codigo: z.string().optional(),
  descripcion: z.string().optional(),
  fecha_inicio: FechaOpcional,
  fecha_fin: FechaOpcional,
})

export const UpdateProyectoSchema = CreateProyectoSchema.extend({
  estado: z.enum(PROYECTO_ESTADOS),
}).refine((p) => !p.fecha_inicio || !p.fecha_fin || p.fecha_inicio <= p.fecha_fin, {
  message: "La fecha de inicio no puede ser posterior a la de fin",
  path: ["fecha_inicio"],
})

export type CreateProyecto = z.infer<typeof CreateProyectoSchema>
export type UpdateProyecto = z.infer<typeof UpdateProyectoSchema>
