"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Item } from "@/models"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ItemComboboxProps {
  value?: number | null
  onChange: (itemId: number | null, item: Item | null) => void
  onCreateNew: () => void
  disabled?: boolean
  placeholder?: string
}

export function ItemCombobox({
  value,
  onChange,
  onCreateNew,
  disabled = false,
  placeholder = "Seleccionar item...",
}: ItemComboboxProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)

  // Cargar items iniciales
  useEffect(() => {
    loadItems("")
  }, [])

  // Cargar item seleccionado si existe
  useEffect(() => {
    if (value) {
      loadSelectedItem(value)
    } else {
      setSelectedItem(null)
    }
  }, [value])

  const loadItems = async (query: string) => {
    setIsLoading(true)
    try {
      const endpoint = query
        ? `/api/items/search?query=${encodeURIComponent(query)}`
        : `/api/items`

      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        setItems(data)
      }
    } catch (error) {
      console.error("Error al cargar items:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSelectedItem = async (itemId: number) => {
    try {
      const response = await fetch(`/api/items/${itemId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedItem(data)
      }
    } catch (error) {
      console.error("Error al cargar item seleccionado:", error)
    }
  }

  const handleSearch = (search: string) => {
    setSearchQuery(search)
    if (search.length >= 2) {
      loadItems(search)
    } else if (search.length === 0) {
      loadItems("")
    }
  }

  const handleSelect = (item: Item) => {
    setSelectedItem(item)
    onChange(item.id, item)
    setOpen(false)
  }

  const handleClear = () => {
    setSelectedItem(null)
    onChange(null, null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedItem ? (
            <span className="truncate">{selectedItem.nombre}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(400px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar item..."
            value={searchQuery}
            onValueChange={handleSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Cargando...
                </span>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="py-6 text-center text-sm">
                    <p className="text-muted-foreground">No se encontraron items</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setOpen(false)
                        onCreateNew()
                      }}
                      className="mt-2"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Crear nuevo item
                    </Button>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {selectedItem && (
                    <CommandItem
                      value="clear"
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      <span className="italic">Limpiar selección</span>
                    </CommandItem>
                  )}
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.nombre}
                      onSelect={() => handleSelect(item)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === item.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium">{item.nombre}</span>
                        {item.descripcion && (
                          <span className="text-xs text-muted-foreground truncate">
                            {item.descripcion}
                          </span>
                        )}
                        <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                          {/* El precio ya no vive en el item: es por proveedor (gu_item_proveedor_precio) */}
                          <span>{item.codigo}</span>
                          {item.unidad_medida && (
                            <span>• {item.unidad_medida}</span>
                          )}
                          {item.categoria && (
                            <span className="italic">• {item.categoria}</span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false)
                      onCreateNew()
                    }}
                    className="bg-muted/50"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="font-medium">Crear nuevo item</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
