"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { PERMISOS_CATALOGO, ACCION_LABEL, type Accion } from "@/shared/permissions-catalog"

interface Props {
  value: string[]
  onChange: (v: string[]) => void
  readOnly?: boolean
}

// Columnas: las 4 acciones en el orden del catálogo. Filas: los 6 módulos.
const ACCIONES = Object.keys(ACCION_LABEL) as Accion[]
const MODULOS = Object.entries(PERMISOS_CATALOGO)

/**
 * Matriz de permisos módulos × acciones. Solo pinta checkbox en celdas cuya acción es válida
 * (proveedores/items no tienen aprobar/borrar). `readOnly` → deshabilitada y todo-tildada (admin).
 */
export function RolPermisosMatrix({ value, onChange, readOnly = false }: Props) {
  const toggle = (clave: string, checked: boolean) => {
    if (readOnly) return
    onChange(checked ? [...value, clave] : value.filter((v) => v !== clave))
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Módulo</th>
            {ACCIONES.map((accion) => (
              <th
                key={accion}
                className="px-3 py-2 text-center font-medium text-muted-foreground whitespace-nowrap"
              >
                {ACCION_LABEL[accion]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULOS.map(([modulo, def]) => (
            <tr key={modulo} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{def.label}</td>
              {ACCIONES.map((accion) => {
                const clave = `${modulo}:${accion}`
                const aplica = (def.acciones as readonly string[]).includes(accion)
                return (
                  <td key={accion} className="px-3 py-2 text-center">
                    {aplica ? (
                      <Checkbox
                        className="mx-auto"
                        checked={readOnly ? true : value.includes(clave)}
                        disabled={readOnly}
                        onCheckedChange={(c) => toggle(clave, c === true)}
                        aria-label={`${def.label}: ${ACCION_LABEL[accion]}`}
                      />
                    ) : (
                      <span className="text-muted-foreground" aria-hidden>
                        —
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
