import { ReporteRepository } from "@/repositories/reporte.repository"
import { ProveedorService } from "@/services/proveedor.service"
import { ProyectoService } from "@/services/proyecto.service"
import { FiltrosReporteSchema, type FiltrosReporte } from "@/shared/validation/reporte-validation"
import type { TablaReporte } from "@/lib/export/tipos"
import { COLUMNAS, calcularTotales, describirFiltros } from "@/lib/export/tablas"

interface ReporteResultado {
  titulo: string
  filtros: FiltrosReporte
  tablas: TablaReporte[]
}

interface Reporte {
  generar(crudos: unknown): Promise<ReporteResultado>
}

type Fila = Record<string, unknown>

// Los nombres se resuelven contra la base, nunca se reciben del cliente: por lo mismo
// que las filas, si no cualquiera imprime el proveedor que quiera en un archivo con
// apariencia oficial.
// Son dos consultas por PK por reporte y el combinado las repite: sobre un botón de
// descarga no se nota. Si llegara a pesar, resolverlos una vez y bajarlos por parámetro.
async function nombresDeFiltros(f: FiltrosReporte) {
  const [proveedor, proyecto] = await Promise.all([
    f.proveedorId ? ProveedorService.getById(f.proveedorId) : null,
    f.proyectoId ? ProyectoService.getById(f.proyectoId) : null,
  ])
  return { proveedor: proveedor?.nombre, proyecto: proyecto?.nombre }
}

// El esqueleto validar -> consultar -> adaptar es idéntico en los seis reportes; lo único
// que varía es el título y qué RPC se consulta. Un mapa alcanza: no hace falta una clase
// por reporte. Las columnas salen de COLUMNAS por nombre.
function reporte(nombre: string, titulo: string, consultar: (f: FiltrosReporte) => Promise<Fila[]>): Reporte {
  return {
    async generar(crudos: unknown): Promise<ReporteResultado> {
      const filtros = FiltrosReporteSchema.parse(crudos)
      const [filas, nombres] = await Promise.all([consultar(filtros), nombresDeFiltros(filtros)])
      const columnas = COLUMNAS[nombre]
      return {
        titulo,
        filtros,
        tablas: [
          {
            titulo,
            filtros: describirFiltros(filtros, nombres),
            columnas,
            filas,
            totales: calcularTotales(columnas, filas),
          },
        ],
      }
    },
  }
}

// Un reporte puede necesitar más de una tabla: el Excel abre una hoja por cada una y el
// CSV las encadena. Sin esto, la evolución mensual se calculaba, se dibujaba en pantalla
// y no llegaba a ningún archivo.
function combinado(titulo: string, ...partes: Reporte[]): Reporte {
  return {
    async generar(crudos: unknown): Promise<ReporteResultado> {
      const generadas = await Promise.all(partes.map((p) => p.generar(crudos)))
      return {
        titulo,
        // Todas las partes parsean los mismos filtros crudos: el primero vale por todos.
        filtros: generadas[0].filtros,
        tablas: generadas.flatMap((p) => p.tablas),
      }
    },
  }
}

const CIRCUITO = reporte("circuito", "Circuito de compras", (f) => ReporteRepository.circuito<Fila>(f))
const CIRCUITO_MENSUAL = reporte("circuito-mensual", "Evolución mensual del circuito", (f) =>
  ReporteRepository.circuitoMensual<Fila>(f)
)
const PENDIENTE = reporte("pendiente-certificar", "Pendiente de certificar", (f) =>
  ReporteRepository.pendienteCertificar<Fila>(f)
)
const DEUDA = reporte("deuda", "Deuda con proveedores", (f) => ReporteRepository.deuda<Fila>(f))
const PROVEEDORES = reporte("proveedores", "Circuito por proveedor", (f) => ReporteRepository.proveedores<Fila>(f))
const PROYECTOS = reporte("proyectos", "Ejecución por proyecto", (f) => ReporteRepository.proyectos<Fila>(f))

// Registry: despacha por nombre y es lo que evita seis rutas copiadas.
export const REPORTES: Record<string, Reporte> = {
  circuito: combinado("Circuito de compras", CIRCUITO, CIRCUITO_MENSUAL),
  // Sigue disponible por separado: la pantalla del circuito lo consulta por su cuenta.
  "circuito-mensual": CIRCUITO_MENSUAL,
  "pendiente-certificar": PENDIENTE,
  deuda: DEUDA,
  proveedores: PROVEEDORES,
  proyectos: PROYECTOS,
  // Un solo libro con todo: bajar cinco archivos para tener el panorama completo era
  // el motivo principal de que el Excel se viera pobre. No es una pestaña, solo export.
  todos: combinado(
    "Reportes del circuito",
    CIRCUITO,
    CIRCUITO_MENSUAL,
    PENDIENTE,
    DEUDA,
    PROVEEDORES,
    PROYECTOS
  ),
}
