"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // ghost y cuadrado, igual que el resto del chrome del header: antes era un botón
  // "outline" con el padding horizontal de size="sm", así que un ícono de 16px vivía en
  // una caja de 40x36 con borde, al lado de dos controles ghost. El placeholder de
  // !mounted repite exactamente la misma caja para que no haya salto al montar.
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="relative h-9 w-9"
      title={`Cambiar a tema ${theme === "light" ? "oscuro" : "claro"}`}
    >
      {/* transition-transform y no transition-all: lo único que cambia entre temas es
          rotate y scale. Con `all`, el ícono también interpolaba color y fondo en cada
          hover, que es lo que hacía que el botón se sintiera blando al pasar por encima. */}
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Alternar tema</span>
    </Button>
  )
}
