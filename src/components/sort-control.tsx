"use client"

import { useCallback, useState } from "react"
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { sortBy, type SortDirection } from "@/shared/sort-utils"

export interface SortField {
  key: string
  label: string
  // Valor por el que ordenar (p.ej. la etiqueta visible de un enum); default: item[key].
  get?: (item: Record<string, unknown>) => unknown
}

export function useSort(fields: SortField[], initial?: SortDirection) {
  const [field, setField] = useState(fields[0].key)
  const [direction, setDirection] = useState<SortDirection>(initial ?? "desc")

  const apply = useCallback(
    <T extends Record<string, unknown>>(items: T[]) =>
      sortBy(items, field, direction, fields.find((f) => f.key === field)?.get),
    [fields, field, direction]
  )

  return { fields, field, setField, direction, setDirection, apply }
}

// Props explicitas y no Omit<ReturnType<typeof useSort>>: los setters se declaran como
// funciones simples para que sirvan los dos origenes -- useSort (ordena en memoria, con
// setters de React) y useSortRemoto (escribe el parametro de orden del listado paginado).
interface Props {
  fields: SortField[]
  field: string
  setField: (valor: string) => void
  direction: SortDirection
  setDirection: (valor: SortDirection) => void
}

export function SortControl({ fields, field, setField, direction, setDirection }: Props) {
  const ascending = direction === "asc"
  const Icon = ascending ? ArrowUpNarrowWide : ArrowDownWideNarrow

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline text-sm text-muted-foreground">Ordenar por</span>
      <Select value={field} onValueChange={setField}>
        <SelectTrigger className="w-40 sm:w-48" aria-label="Ordenar por">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((c) => (
            <SelectItem key={c.key} value={c.key}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setDirection(ascending ? "desc" : "asc")}
        title={ascending ? "Ascendente" : "Descendente"}
        aria-label={`Orden ${ascending ? "ascendente" : "descendente"}, cambiar`}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </div>
  )
}

/**
 * Adaptador para listados con orden en el SERVIDOR: el mismo SortControl, pero manejando el
 * parametro `orden=columna.dir` del hook en vez de ordenar el array en memoria.
 *
 * Las `key` de los campos tienen que ser columnas reales de la tabla y estar en la whitelist
 * COLUMNAS_ORDEN de la ruta; si no, el server cae al orden por defecto.
 */
export function useSortRemoto(fields: SortField[], orden: string, setOrden: (v: string) => void) {
  const [columna, direccion] = orden.split(".")
  const dir: SortDirection = direccion === "asc" ? "asc" : "desc"

  return {
    fields,
    field: columna,
    setField: (f: string) => setOrden(`${f}.${dir}`),
    direction: dir,
    setDirection: (d: SortDirection) => setOrden(`${columna}.${d}`),
  }
}
