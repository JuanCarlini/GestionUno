import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"
import { ProveedorRepository } from "@/repositories/proveedor.repository"
import { Proveedor, EstadoProveedor } from "@/models"
import type { Orden, Pagina, Paginacion } from "@/lib/route/paginacion"
import type { FiltrosListado } from "@/repositories/filtros"

// Reglas de negocio de proveedores. El acceso a datos vive en ProveedorRepository:
// acá solo quedan las decisiones de dominio (normalizar estado, default al crear).
export class ProveedorService {
  // Una página del listado, con el mismo saneo de estado que getAll.
  static async getPagina(
    p: Paginacion,
    opts: { filtros?: FiltrosListado; orden?: Orden } = {}
  ): Promise<Pagina<Proveedor>> {
    const { data, total } = await ProveedorRepository.findPagina(p, {
      ...opts,
      columnasTexto: ["nombre", "cuit", "email", "telefono", "direccion"],
    })
    return { total, data: data.map((pr) => ({ ...pr, estado: pr.estado ?? "activo" }) as Proveedor) }
  }

  static async getAll(): Promise<Proveedor[]> {
    const proveedores = await ProveedorRepository.findAll()
    // normalizo estado a 'activo' si viene null
    return proveedores.map((p) => ({
      ...p,
      estado: p.estado ?? EstadoProveedor.ACTIVO,
    }))
  }

  static async getById(id: number): Promise<Proveedor | null> {
    const proveedor = await ProveedorRepository.findById(id)
    if (!proveedor) return null
    return {
      ...proveedor,
      estado: proveedor.estado ?? EstadoProveedor.ACTIVO,
    }
  }

  static async create(proveedor: Omit<TablesInsert<"gu_proveedores">, "estado">): Promise<Proveedor> {
    // un proveedor nuevo siempre nace activo; el estado no lo fija el cliente
    return ProveedorRepository.insert({ ...proveedor, estado: EstadoProveedor.ACTIVO })
  }

  static async update(id: number, proveedor: TablesUpdate<"gu_proveedores">): Promise<Proveedor | null> {
    return ProveedorRepository.update(id, proveedor)
  }

  static async delete(id: number): Promise<boolean> {
    return ProveedorRepository.delete(id)
  }
}
