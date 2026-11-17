"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchBar({ 
  value, 
  onChange, 
  placeholder = "Buscar…", 
  className = "" 
}: SearchBarProps) {
  const handleClear = () => {
    onChange("")
  }

  return (
    <div className={`relative max-w-sm ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>
      {/* spellCheck apagado: acá se escriben números de documento, CUIT y códigos, no
          prosa, y el subrayado rojo del corrector sobre "OC-0013" no ayuda a nadie.
          enterKeyHint para que en un teléfono la tecla de acción diga "buscar". */}
      <Input
        type="text"
        spellCheck={false}
        enterKeyHint="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10"
      />
      {value && (
        <div className="absolute inset-y-0 right-0 pr-1 flex items-center">
          {/* Tres cosas que estaban mal en este botón:
              - no tenía nombre: es un botón de solo ícono, así que un lector de pantalla
                leía "botón" y nada más.
              - hover:text-muted-foreground sobre un texto que ya es muted-foreground, o
                sea: no pasaba nada al pasar por encima. Ahora sube a foreground.
              - 28px de lado. El mínimo para un objetivo táctil es 44, que no entra en un
                input de 40; 36 es lo más grande que entra y es 8px más que antes.
              type="button" porque el buscador vive dentro de formularios: sin eso, limpiar
              la búsqueda podía mandar el form. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            aria-label="Limpiar búsqueda"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}