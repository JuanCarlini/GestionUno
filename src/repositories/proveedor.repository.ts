import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import { Proveedor } from "@/models"
import { createBaseRepository } from "./base.repository"

// Repositorio de gu_proveedores: CRUD estándar (patrón base). Solo I/O — la normalización
// de estado y los defaults viven en ProveedorService.
export const ProveedorRepository = createBaseRepository<
  Proveedor,
  TablesInsert<"gu_proveedores">,
  TablesUpdate<"gu_proveedores">
>("gu_proveedores")
