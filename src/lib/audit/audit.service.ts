import { HttpError } from '@/lib/route/http-error'
import { UsuarioRepository } from '@/repositories/usuario.repository'
import { AuditoriaRepository } from '@/repositories/auditoria.repository'

// Valores del enum audit_accion (columna gu_audit_log.accion). La bitácora
// (gu_auditoria.accion) es texto libre y acepta cualquier filtro.
const ACCIONES_CAMBIO = ['crear', 'actualizar', 'eliminar'] as const

interface ConsultaAuditoria {
  fuente: 'bitacora' | 'cambios'
  usuarioId?: string | null
  tabla?: string | null
  accion?: string | null
  desde?: string | null // YYYY-MM-DD
  hasta?: string | null // YYYY-MM-DD
}

// Bitácora de operaciones con usuario, escrita server-side (el JWT identifica al usuario) en
// gu_auditoria. Complementa el control de cambios que los triggers escriben en gu_audit_log.

// gu_auditoria.accion es TEXTO LIBRE (el enum audit_accion es de gu_audit_log), así que
// sumar un valor acá no necesita migración.
export type AccionAuditoria =
  | 'login' | 'login_fallido' | 'logout'
  | 'crear' | 'actualizar' | 'eliminar'
  | 'aprobar' | 'rechazar' | 'anular'
  | 'activar' | 'desactivar' | 'resetear'

interface RegistrarParams {
  usuarioId: number
  tabla: string          // entidad afectada (ej. 'gu_certificaciones', 'sesion')
  registroId: number     // id del registro afectado
  accion: AccionAuditoria
  detalle?: string       // descripción legible de la operación
}

export class AuditService {
  /**
   * Registra una operación en la bitácora. Nunca lanza: un fallo de auditoría
   * no debe romper la operación de negocio que la disparó (best-effort).
   */
  static async registrar({ usuarioId, tabla, registroId, accion, detalle }: RegistrarParams): Promise<void> {
    try {
      await AuditoriaRepository.insertBitacora({ usuarioId, tabla, registroId, accion, detalle })
    } catch (error) {
      console.error('AuditService.registrar falló (no bloqueante):', error)
    }
  }

  /**
   * Registra un login fallido en la auditoría. Como gu_auditoria.usuario_id es NOT NULL, solo
   * persiste si el email existe; para uno inexistente queda un warn (señal de enumeración).
   */
  static async registrarLoginFallido(email: string, ip: string): Promise<void> {
    try {
      const usuario = await UsuarioRepository.findByEmail(email)
      if (!usuario) {
        // Enmascarado: la señal de enumeración (dominio + forma) se conserva sin volcar
        // el email completo de un tercero al log.
        const enmascarado = email.replace(/^(.).*?(@.*)$/, "$1***$2")
        console.warn(`login_fallido email_inexistente=${enmascarado} ip=${ip}`)
        return
      }
      await AuditService.registrar({
        usuarioId: usuario.id,
        tabla: 'sesion',
        registroId: usuario.id,
        accion: 'login_fallido',
        detalle: `Login fallido para ${email} desde ${ip}`,
      })
    } catch (error) {
      console.error('AuditService.registrarLoginFallido falló (no bloqueante):', error)
    }
  }

  /**
   * Consulta de auditoría (/admin/auditoria) desde dos fuentes: 'bitacora' (gu_auditoria,
   * operaciones con usuario) y 'cambios' (gu_audit_log, valores anteriores/nuevos).
   */
  static async consultar(f: ConsultaAuditoria) {
    if (f.fuente === 'cambios') {
      // El filtro se compara contra un enum de Postgres: un valor fuera del enum
      // reventaba la query. Antes un 400 que un 500 silencioso.
      if (f.accion && !(ACCIONES_CAMBIO as readonly string[]).includes(f.accion)) {
        throw new HttpError(
          400,
          `Acción inválida para el control de cambios. Válidas: ${ACCIONES_CAMBIO.join(', ')}`
        )
      }

      const filas = await AuditoriaRepository.findCambios(f)
      return filas.map((r: any) => ({
        id: r.id,
        tabla: r.tabla_afectada,
        registro_id: r.registro_id,
        usuario: r.gu_usuario?.nombre ?? (r.usuario_id ? `#${r.usuario_id}` : 'sistema/directo'),
        accion: r.accion,
        datos_anteriores: r.datos_anteriores,
        datos_nuevos: r.datos_nuevos,
        fecha: r.created_at,
      }))
    }

    const filas = await AuditoriaRepository.findBitacora(f)
    return filas.map((r: any) => ({
      id: r.id,
      tabla: r.tabla_origen,
      registro_id: r.registro_id,
      usuario: r.gu_usuario?.nombre ?? `#${r.usuario_id}`,
      accion: r.accion,
      detalle: r.motivo_cambio,
      fecha: r.fecha_cambio,
    }))
  }
}
