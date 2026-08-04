"use client"

import { Suspense, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FiltrosBar, type Opcion } from "./filtros-bar"
import { TabCircuito } from "./tab-circuito"
import { TabPendiente } from "./tab-pendiente"
import { TabDeuda } from "./tab-deuda"
import { TabProveedores } from "./tab-proveedores"
import { TabProyectos } from "./tab-proyectos"
import { AccionesExport } from "./acciones-export"
import "./paleta.css"
import "@/app/(dashboard)/reportes/print.css"

// Una sola lista de pestañas: value de la pestaña, nombre que espera la API de export,
// título visible y componente. Con tres listas paralelas, agregar un reporte obligaba a
// editar las tres y nada avisaba si se olvidaba una.
const PESTANAS = [
  { value: "circuito", api: "circuito", titulo: "Circuito", Componente: TabCircuito },
  { value: "pendiente", api: "pendiente-certificar", titulo: "Pendiente de certificar", Componente: TabPendiente },
  { value: "deuda", api: "deuda", titulo: "Deuda", Componente: TabDeuda },
  { value: "proveedores", api: "proveedores", titulo: "Proveedores", Componente: TabProveedores },
  { value: "proyectos", api: "proyectos", titulo: "Proyectos", Componente: TabProyectos },
] as const

export function ReportesShell({
  proveedores,
  proyectos,
}: {
  proveedores: Opcion[]
  proyectos: Opcion[]
}) {
  const [activa, setActiva] = useState("circuito")
  const pestanaActiva = PESTANAS.find((p) => p.value === activa) ?? PESTANAS[0]

  return (
    <div className="reportes-viz space-y-6">
      {/* Solo visible al imprimir: en pantalla los filtros y las pestañas ya lo dicen.
          suppressHydrationWarning: la fecha se calcula en el server y de nuevo al hidratar;
          cruzando la medianoche difieren y React lo marcaría como mismatch. */}
      <div className="encabezado-impresion">
        <h2 className="text-xl font-bold">Reportes — {pestanaActiva.titulo}</h2>
        <p className="text-sm" suppressHydrationWarning>
          Generado el {new Date().toLocaleDateString("es-AR")}
        </p>
      </div>

      {/* FiltrosBar usa useSearchParams: sin Suspense, Next 15 rompe el prerenderizado
          de la página en el build. */}
      <Suspense>
        <FiltrosBar proveedores={proveedores} proyectos={proyectos} />
      </Suspense>

      <Tabs value={activa} onValueChange={setActiva}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="no-imprimir max-w-full justify-start overflow-x-auto scrollbar-none">
            {PESTANAS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>{p.titulo}</TabsTrigger>
            ))}
          </TabsList>
          <AccionesExport reporte={pestanaActiva.api} />
        </div>

        {PESTANAS.map(({ value, Componente }) => (
          <TabsContent key={value} value={value} className="mt-6"><Componente /></TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
