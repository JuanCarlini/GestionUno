import { z } from "zod"
import { ESTADOS_APROBACION } from "@/models/enums"

// El ÚNICO input de una línea de certificación es avance_unidades: avance_monto,
// avance_porcentaje, iva_porcentaje y numero_lce los deriva el trigger fn_lce_derive.
export const CreateCertificacionLineaSchema = z.object({
  linea_oc_id: z.number().int().positive("La línea de OC es requerida"),
  avance_unidades: z.number().positive("El avance debe ser mayor a 0"),
})

// numero_cert lo genera la DB; proveedor_id lo hereda de la OC; estado lo fija el server.
// Los totales los suma la app desde las líneas derivadas. Nada de eso se acepta del cliente.
export const CreateCertificacionSchema = z.object({
  orden_compra_id: z.number().int().positive("La orden de compra es requerida"),
  fecha_devengado: z.string().nullish(),
  observaciones: z.string().nullish(),
  lineas: z.array(CreateCertificacionLineaSchema).min(1, "La certificación debe tener al menos una línea"),
})

// Solo cabecera. Las líneas no se editan (se borra el borrador y se rehace) y el estado
// va por PATCH /api/certificaciones/[id]/estado.
export const UpdateCertificacionSchema = z.object({
  fecha_devengado: z.string().nullish(),
  observaciones: z.string().nullish(),
})

export const CambiarEstadoCertificacionSchema = z.object({ estado: z.enum(ESTADOS_APROBACION) })
