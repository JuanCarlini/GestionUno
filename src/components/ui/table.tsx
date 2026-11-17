import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { containerClassName?: string }
>(({ className, containerClassName, ...props }, ref) => (
  // containerClassName llega al div que scrollea, no a la <table>. Hace falta para que una
  // tabla larga pueda pedir su propio alto (max-h-...): este div es overflow-auto, o sea
  // que es el contenedor de scroll, y mientras su alto sea automático nunca scrollea él
  // —scrollea la página— y un thead sticky adentro no tiene contra qué pegarse. Con un
  // max-h, el div scrollea de verdad y el encabezado se queda arriba.
  // overscroll-x-contain: estas tablas son anchas y en un teléfono se recorren de costado.
  // Al llegar al borde, ese mismo gesto lo toma el navegador como "volver atrás", así que
  // buscar una columna terminaba saliendo de la pantalla. Esto encierra el gesto.
  <div className={cn("relative w-full overflow-auto overscroll-x-contain", containerClassName)}>
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  // El encabezado se queda arriba mientras se recorre la tabla: en una bitácora de
  // auditoría de cientos de filas, saber qué columna se está mirando importa.
  //
  // top-0 y no un offset por la barra de la app: esto se pega contra el div de Table, que
  // es el contenedor de scroll, no contra la ventana. Solo tiene efecto si ese div tiene
  // un alto acotado (containerClassName con un max-h); en una tabla corta no molesta.
  // bg-card porque estas tablas viven dentro de una Card y, sin fondo opaco, las filas
  // pasarían por debajo y se leerían encima del texto del encabezado.
  <thead
    ref={ref}
    className={cn("sticky top-0 z-10 bg-card [&_tr]:border-b", className)}
    {...props}
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

