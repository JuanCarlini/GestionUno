import { z } from "zod"
import { ESTADOS_FACTURA, MONEDAS } from "@/models/enums"

// Línea de factura. La columna de precio es `precio_unitario` (no `_neto` como en LOC).
// Los totales los calcula el server (no se aceptan del cliente).
const CreateFacturaLineaSchema = z.object({
  descripcion: z.string().min(1, "La descripción de la línea es requerida"),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0"),
  precio_unitario: z.number().min(0),
  iva_porcentaje: z.number().min(0).max(100).optional(),
})

// Imputación N:M a una certificación aprobada, con su monto.
const CreateImputacionSchema = z.object({
  certificacion_id: z.number().int().positive(),
  monto_asignado: z.number().positive("El monto imputado debe ser mayor a 0"),
})

// numero_factura, estado y los totales NO se aceptan del cliente: DB / server / cálculo.
export const CreateFacturaSchema = z.object({
  proveedor_id: z.number().int().positive("El proveedor es requerido"),
  fecha_emision: z.string().min(1, "La fecha es requerida"),
  moneda: z.enum(MONEDAS).optional(),
  numero_comprobante: z.string().nullish(),
  punto_venta: z.string().nullish(),
  observaciones: z.string().nullish(),
  lineas: z.array(CreateFacturaLineaSchema).min(1, "Debe haber al menos una línea"),
  imputaciones: z.array(CreateImputacionSchema).optional().default([]),
})

export const CambiarEstadoFacturaSchema = z.object({ estado: z.enum(ESTADOS_FACTURA) })

export const ImputarSchema = z.object({
  imputaciones: z.array(CreateImputacionSchema).min(1, "Indicá al menos una imputación"),
})
