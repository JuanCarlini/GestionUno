import { createBaseRepository } from "./base.repository"
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"

// Repositorio de gu_proyectos: CRUD estándar — findAll/findById/insert/update/delete
// idénticos al patrón base. Tipado en el borde con los tipos generados de Supabase.
export const ProyectoRepository = createBaseRepository<
  Tables<"gu_proyectos">,
  TablesInsert<"gu_proyectos">,
  TablesUpdate<"gu_proyectos">
>("gu_proyectos")
