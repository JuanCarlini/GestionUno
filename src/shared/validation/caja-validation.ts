import { z } from "zod"
import { CAJA_TIPOS, MONEDAS } from "@/models/enums"

// `is_active` lo fija el server. La moneda se elige al crear y no se cambia después
// (CajaService.update lo rechaza con 422): fn_op_gate depende de ella.
export const CreateCajaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(200),
  tipo: z.enum(CAJA_TIPOS),
  entidad: z.string().max(200).nullish(),
  moneda: z.enum(MONEDAS).default("ARS"),
})

export const UpdateCajaSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  tipo: z.enum(CAJA_TIPOS).optional(),
  entidad: z.string().max(200).nullish(),
  moneda: z.enum(MONEDAS).optional(), // se acepta para poder rechazarlo con un mensaje claro
})
