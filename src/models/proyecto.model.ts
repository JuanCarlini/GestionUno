import type { Database } from "@/lib/supabase/database.types"

export type Proyecto = Database["public"]["Tables"]["gu_proyectos"]["Row"]
export type EstadoProyecto = Database["public"]["Enums"]["proyecto_estado"]
