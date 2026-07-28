import { z } from "zod"
import { ESTADOS_OP, MONEDAS } from "@/models/enums"

// La OP nace vacía (solo cabecera): numero_op lo genera la DB, estado lo fija el server,
// total_a_pagar arranca en 0 y lo suben las líneas de factura.
export const CreateOrdenPagoSchema = z.object({
  proveedor_id: z.number().int().positive("El proveedor es requerido"),
  fecha_op: z.string().min(1, "La fecha es requerida"),
  moneda: z.enum(MONEDAS).optional(),
  observaciones: z.string().nullish(),
})

export const AgregarFacturaSchema = z.object({
  factura_id: z.number().int().positive(),
  monto: z.number().positive("El monto debe ser mayor a 0"),
})

export const AgregarCajaSchema = z.object({
  caja_id: z.number().int().positive(),
  monto: z.number().positive("El monto debe ser mayor a 0"),
})

export const CambiarEstadoOPSchema = z.object({ estado: z.enum(ESTADOS_OP) })
