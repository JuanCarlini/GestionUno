import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// El press responde en pointer-down, no al soltar: en touch no hay hover, así que sin esto
// tocar un botón no devuelve nada hasta que cambia la pantalla.
//
// Un botón ancho se hunde menos. El hundimiento se siente por cuánto se corre el borde, y
// eso crece con el ancho: al 0.97 un submit de ancho completo (medido: 399px) mueve cada
// borde 6px y se lee deformado, no hundido; al 0.99 mueve 2px. El selector compuesto —dos
// clases + :active— le gana en especificidad al 0.97 de arriba.
const buttonVariants = cva(
  // touch-manipulation: en un navegador móvil, un elemento pulsable que no lo declara
  // reserva ~300ms esperando a ver si el toque es un doble tap para hacer zoom, y recién
  // ahí dispara el click. El press en pointer-down tapa parte de esa espera, pero la acción
  // igual llegaba tarde. Con esto, el navegador sabe que acá no hay doble tap que esperar.
  "inline-flex touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[color,background-color,border-color,transform] duration-100 active:scale-[0.97] [&.w-full]:active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        success:
          "bg-success text-success-foreground hover:bg-success/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
