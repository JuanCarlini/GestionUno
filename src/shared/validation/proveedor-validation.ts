import { z } from "zod"
import { EstadoProveedor } from "@/models"

// Alineado con el modelo real (gu_proveedores + proveedor-form.tsx): nombre, cuit,
// email, telefono, direccion.
export const CreateProveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  cuit: z.string().min(1, "El CUIT es requerido"),
  email: z.string().email("Email inválido").or(z.literal("")).optional(),
  telefono: z.string().or(z.literal("")).optional(),
  direccion: z.string().or(z.literal("")).optional()
})

export const UpdateProveedorSchema = CreateProveedorSchema.partial().extend({
  estado: z.nativeEnum(EstadoProveedor).optional()
})
