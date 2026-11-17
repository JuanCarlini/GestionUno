"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      expand={true}
      gap={8}
      offset={16}
      closeButton={true}
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // El tipo lo dice el ícono, con la tinta del estado.
          //
          // Antes estaba `richColors`, que le da a cada tipo su fondo y su texto, pero la
          // clase `toast` de acá abajo forzaba bg-background sobre todos: el fondo de color
          // nunca llegaba a verse y un éxito y un error quedaban idénticos salvo la forma
          // del ícono. En vez de pelear, se saca richColors y se colorea solo el ícono, con
          // los tokens de la app en lugar de la paleta propia de sonner (que no está medida
          // contra este fondo). El toast sigue opaco, que es lo que necesita estar encima
          // del contenido.
          //
          // Va en el ícono y no en el borde a propósito: el borde ya lo pinta la clase
          // `toast` con la misma especificidad, y dos clases iguales peleando se resuelven
          // por orden en el CSS generado, que no es algo para apoyarse. Si alguna vez se
          // quiere el borde de color, este es el lugar, con el modificador `!`.
          success: "[&_[data-icon]]:text-success-ink",
          error: "[&_[data-icon]]:text-destructive-ink",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

