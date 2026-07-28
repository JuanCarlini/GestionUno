import { CajaRepository } from "@/repositories/caja.repository"
import { HttpError } from "@/lib/route/http-error"
import type { Caja, CreateCajaData, UpdateCajaData } from "@/models"

// Reglas de negocio de cajas (fondos/medios de pago). El I/O vive en CajaRepository.
export class CajaService {
  static async getAll(): Promise<Caja[]> {
    return CajaRepository.findAllActive()
  }

  static async getAllIncludingInactive(): Promise<Caja[]> {
    return CajaRepository.findAll()
  }

  static async getById(id: number): Promise<Caja | null> {
    return CajaRepository.findById(id)
  }

  // Una caja nueva siempre nace activa; el cliente no fija el estado.
  static async create(caja: CreateCajaData): Promise<Caja> {
    return CajaRepository.insert({ ...caja, is_active: true })
  }

  static async update(id: number, caja: UpdateCajaData): Promise<Caja | null> {
    const actual = await CajaRepository.findById(id)
    if (!actual) throw new HttpError(404, "Caja no encontrada")

    // fn_op_gate exige que todas las cajas de una OP compartan su moneda: cambiarla a posteriori
    // invalidaría en silencio las OP que ya la usan (por eso se crea una nueva y se baja la vieja).
    if (caja.moneda !== undefined && caja.moneda !== actual.moneda) {
      throw new HttpError(
        422,
        "No se puede cambiar la moneda de una caja existente. Creá una caja nueva y dá de baja esta."
      )
    }

    return CajaRepository.update(id, caja)
  }

  // Baja lógica: las líneas de OP (gu_lineasdeordenesdepagocaja) apuntan a la caja.
  static async delete(id: number): Promise<boolean> {
    const actual = await CajaRepository.findById(id)
    if (!actual) throw new HttpError(404, "Caja no encontrada")
    return CajaRepository.setActive(id, false)
  }

  static async reactivate(id: number): Promise<boolean> {
    return CajaRepository.setActive(id, true)
  }
}
