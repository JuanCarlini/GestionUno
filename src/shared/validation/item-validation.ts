import { z } from "zod"

// El precio ya no vive en el item (es agnóstico al proveedor): está en
// gu_item_proveedor_precio. `codigo` es UNIQUE en la DB → un duplicado sale 409.
export const CreateItemSchema = z.object({
  codigo: z.string().min(1, "El código es requerido").max(50, "El código no puede exceder 50 caracteres"),
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(200, "El nombre no puede exceder 200 caracteres"),
  descripcion: z.string().optional().nullable(),
  unidad_medida: z.string().max(50, "La unidad de medida no puede exceder 50 caracteres").optional().nullable(),
  categoria: z.string().max(100, "La categoría no puede exceder 100 caracteres").optional().nullable(),
})

export const UpdateItemSchema = CreateItemSchema.partial().extend({
  is_active: z.boolean().optional()
})

export type CreateItemFormData = z.infer<typeof CreateItemSchema>
