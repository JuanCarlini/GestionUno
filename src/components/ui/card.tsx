import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: "h1" | "h2" | "h3" }
>(({ className, as: Etiqueta = "h2", ...props }, ref) => (
  // h2 y no div. Con un div, la app tenía un solo encabezado —el h1 de PageHeader— y
  // ningún h2: quien navega por encabezados con un lector de pantalla no tenía forma de
  // saltar entre las secciones de una pantalla, que es justo para lo que sirven. Cada
  // tarjeta es una sección de su página, así que h2 es el nivel que corresponde.
  //
  // `as` existe por las pantallas de detalle: no tienen PageHeader, el título del
  // documento ES el título de la página y va con as="h1". Sin eso, esas pantallas
  // empezarían en h2 y el orden quedaría roto al revés.
  //
  // El preflight de Tailwind le saca a los h1-h6 su tamaño y peso por defecto, así que
  // cambiar la etiqueta no mueve ni un píxel.
  <Etiqueta
    ref={ref}
    className={cn(
      // Sin tracking fijo: lo pone la escala de tamaños (tailwind.config.ts), que lo
      // ajusta por tamaño. Acá hace falta porque el CardTitle se usa también con
      // md:text-3xl encima, y un valor clavado no acompaña ese cambio.
      //
      // 18px, no 24px. En 24 el título de tarjeta medía exactamente lo mismo que el
      // h1 de PageHeader abajo de md —los dos text-2xl— y solo los separaba el peso:
      // la página y cada tarjeta dentro de ella pesaban igual. Además la escala tenía
      // un hueco entre el cuerpo (14px) y los títulos (24px), así que todo lo
      // intermedio caía en text-sm y la jerarquía se aplastaba. Los títulos que SÍ
      // hacen de encabezado de pantalla —las pantallas de detalle, que no tienen
      // PageHeader— se suben a mano con text-2xl md:text-3xl donde hace falta.
      //
      // leading-tight y no leading-none: con la caja igual al tamaño de la fuente, un
      // título de dos líneas ("Órdenes de Compra (1234)" en una columna angosta) se
      // toca consigo mismo.
      // text-balance: un título de dos líneas reparte el texto entre las dos en vez de
      // dejar una palabra sola abajo.
      "text-balance text-lg font-semibold leading-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

