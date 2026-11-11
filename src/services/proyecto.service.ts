import { ProyectoRepository } from "@/repositories/proyecto.repository"
import type { Orden, Pagina, Paginacion } from "@/lib/route/paginacion"
import type { FiltrosListado } from "@/repositories/filtros"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"

// CRUD de proyectos. Sin reglas de negocio propias hoy: delega el I/O al repo y mantiene la
// convención ruta -> service -> repo uniforme.
export class ProyectoService {
  static getAll() {
    return ProyectoRepository.findAll()
  }

  static getPagina(p: Paginacion, opts: { filtros?: FiltrosListado; orden?: Orden } = {}) {
    return ProyectoRepository.findPagina(p, {
      ...opts,
      columnasTexto: ["nombre", "codigo", "descripcion"],
    })
  }

  static getById(id: number) {
    return ProyectoRepository.findById(id)
  }

  static create(proyecto: TablesInsert<"gu_proyectos">) {
    return ProyectoRepository.insert(proyecto)
  }

  static update(id: number, proyecto: TablesUpdate<"gu_proyectos">) {
    return ProyectoRepository.update(id, proyecto)
  }
}
