import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, inputMode, onWheel, ...props }, ref) => {
    // Los 12 campos numéricos de la app son plata, cantidades y porcentajes, todos con
    // step 0.01. Va acá y no en cada uno para que el próximo campo numérico no se olvide;
    // quien necesite otro (un entero, un teléfono) lo pasa y gana.
    const esNumero = type === "number"
    return (
      <input
        type={type}
        // Sin esto, en un teléfono type="number" abre un teclado sin coma decimal en varias
        // combinaciones de teclado y sistema, y acá se escriben importes.
        inputMode={inputMode ?? (esNumero ? "decimal" : undefined)}
        onWheel={(e) => {
          onWheel?.(e)
          // La rueda del mouse sobre un type="number" enfocado le cambia el valor: en una
          // pantalla de carga larga, alcanza con pasar scrolleando por encima de un importe
          // ya escrito para modificarlo sin enterarse. Se le saca el foco y la rueda sigue
          // a la página; no se puede usar preventDefault porque React engancha onWheel como
          // listener pasivo.
          if (esNumero && document.activeElement === e.currentTarget) {
            e.currentTarget.blur()
          }
        }}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

