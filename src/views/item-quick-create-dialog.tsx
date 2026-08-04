"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { CreateItemSchema, CreateItemFormData } from "@/shared/validation/item-validation"
import { Item, ItemCategoria, UnidadMedida } from "@/models"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { showSuccessToast, showErrorToast } from "@/shared/toast-helpers"

interface ItemQuickCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onItemCreated?: (item: Item) => void
}

export function ItemQuickCreateDialog({
  open,
  onOpenChange,
  onItemCreated,
}: ItemQuickCreateDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<CreateItemFormData>({
    resolver: zodResolver(CreateItemSchema),
    defaultValues: {
      codigo: "",
      nombre: "",
      descripcion: null,
      unidad_medida: null,
      categoria: null,
    },
  })

  const onSubmit = async (data: CreateItemFormData) => {
    setIsLoading(true)

    try {
      // created_by lo fija el server desde el JWT; el cliente no lo manda.
      const response = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        let errorMessage = "Error al crear el item"
        try {
          const error = await response.json()
          errorMessage = error.error || error.message || errorMessage
        } catch (e) {
          // Si no se puede parsear como JSON, usar el texto
          const text = await response.text()
          errorMessage = text || `Error ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const nuevoItem = await response.json() as Item

      showSuccessToast("Item creado", `"${nuevoItem.nombre}" se ha creado exitosamente`)

      // Cerrar el dialog y notificar
      form.reset({
        codigo: "",
        nombre: "",
        descripcion: null,
        unidad_medida: null,
        categoria: null,
      })
      onOpenChange(false)
      onItemCreated?.(nuevoItem)
    } catch (error) {
      console.error("Error al crear item:", error)
      showErrorToast("Error", error instanceof Error ? error.message : "Error al crear el item")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Item</DialogTitle>
          <DialogDescription>
            Agrega un nuevo producto o servicio al catálogo para usar en órdenes de compra.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nombre */}
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Nombre <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Cemento Portland"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descripción */}
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalles adicionales del item..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      value={field.value || ""}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Opcional: Información adicional sobre el producto o servicio
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Código y Unidad de Medida en la misma fila.
                El precio ya no es del item: vive en gu_item_proveedor_precio (por proveedor)
                y se carga al vuelo desde la línea de OC. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Código <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="COD-0001"
                        {...field}
                        value={field.value || ""}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unidad_medida"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidad de Medida</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Ninguna" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(UnidadMedida).map((unidad) => (
                          <SelectItem key={unidad} value={unidad}>
                            {unidad}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Categoría */}
            <FormField
              control={form.control}
              name="categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Ninguna" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(ItemCategoria).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Ayuda a organizar el catálogo de items
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Item"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
