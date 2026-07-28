import { z } from "zod"

// Whitelist de campos para crear un proyecto. `estado` se OMITE a propósito: lo pone el
// default de la DB, no el cliente (anti mass-assignment); Zod descarta los campos extra.
export const CreateProyectoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  codigo: z.string().optional(),
  descripcion: z.string().optional(),
  fecha_inicio: z.string().optional(),
  fecha_fin: z.string().optional(),
})
