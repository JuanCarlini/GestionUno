"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MONEDAS } from "@/models/enums"
import { MONEDA_TODAS } from "@/shared/validation/reporte-validation"

export interface Opcion {
  id: number
  nombre: string
}

// Centinela para "sin filtrar": Radix Select no admite un SelectItem con value="".
const TODAS = "todas"

// Los filtros viven en la URL: el reporte filtrado se comparte por link, sobrevive al
// refresco y el botón de retroceso funciona. Sin librería de estado.
export function FiltrosBar({
  proveedores,
  proyectos,
}: {
  proveedores: Opcion[]
  proyectos: Opcion[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function navegar(siguiente: URLSearchParams) {
    router.replace(`${pathname}?${siguiente.toString()}`)
  }

  function setFiltro(clave: string, valor: string) {
    const siguiente = new URLSearchParams(params.toString())
    if (valor === "" || valor === TODAS) siguiente.delete(clave)
    else siguiente.set(clave, valor)
    navegar(siguiente)
  }

  function setMoneda(valor: string) {
    const siguiente = new URLSearchParams(params.toString())
    siguiente.set("moneda", valor)
    navegar(siguiente)
  }

  return (
    <div className="no-imprimir grid grid-cols-2 items-end gap-4 rounded-lg border p-4 lg:flex lg:flex-wrap">
      <div className="space-y-1">
        <Label htmlFor="desde">Desde</Label>
        <Input
          id="desde"
          type="date"
          value={params.get("desde") ?? ""}
          onChange={(e) => setFiltro("desde", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="hasta">Hasta</Label>
        <Input
          id="hasta"
          type="date"
          value={params.get("hasta") ?? ""}
          onChange={(e) => setFiltro("hasta", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="moneda">Moneda</Label>
        <Select
          value={params.get("moneda") ?? "ARS"}
          onValueChange={(v) => setMoneda(v)}
        >
          <SelectTrigger id="moneda" className="w-full lg:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONEDAS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
            <SelectItem value={MONEDA_TODAS}>Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-2 space-y-1 sm:col-span-1">
        <Label htmlFor="proveedor">Proveedor</Label>
        <Select
          value={params.get("proveedorId") ?? TODAS}
          onValueChange={(v) => setFiltro("proveedorId", v)}
        >
          <SelectTrigger id="proveedor" className="w-full lg:w-56">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todos</SelectItem>
            {proveedores.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-2 space-y-1 sm:col-span-1">
        <Label htmlFor="proyecto">Proyecto</Label>
        <Select
          value={params.get("proyectoId") ?? TODAS}
          onValueChange={(v) => setFiltro("proyectoId", v)}
        >
          <SelectTrigger id="proyecto" className="w-full lg:w-56">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todos</SelectItem>
            {proyectos.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
