"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { showSuccessToast, showErrorToast } from "@/shared/toast-helpers"

const proveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  cuit: z.string().min(1, "El CUIT es requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefono: z.string().optional().or(z.literal("")),
  direccion: z.string().optional().or(z.literal(""))
})

type FormData = z.infer<typeof proveedorSchema>

interface Props {
  proveedor?: any
  isEditing?: boolean
}

export function ProveedorForm({ proveedor, isEditing = false }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const form = useForm<FormData>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: {
      nombre: proveedor?.nombre || "",
      cuit: proveedor?.cuit || "",
      email: proveedor?.email || "",
      telefono: proveedor?.telefono || "",
      direccion: proveedor?.direccion || ""
    }
  })

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true)
      setError(null)

      if (isEditing && proveedor) {
        const response = await fetch(`/api/proveedores/${proveedor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Error al actualizar proveedor')
        }
        
        showSuccessToast("Proveedor actualizado", "El proveedor se actualizó correctamente")
        router.push(`/proveedores/${proveedor.id}`)
      } else {
        const response = await fetch('/api/proveedores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Error al crear proveedor')
        }
        
        showSuccessToast("Proveedor creado", "El proveedor se creó correctamente")
        router.push('/proveedores')
      }
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : "Error al guardar el proveedor")
      showErrorToast("Error", err instanceof Error ? err.message : "Error al guardar el proveedor")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? "Editar Proveedor" : "Nuevo Proveedor"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-6" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">Información Básica</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre de la Empresa *</Label>
                <Input
                  id="nombre"
                  {...form.register("nombre")}
                  placeholder="Nombre de la empresa"
                />
                {form.formState.errors.nombre && (
                  <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT *</Label>
                <Input
                  id="cuit"
                  {...form.register("cuit")}
                  placeholder="20-12345678-9"
                />
                {form.formState.errors.cuit && (
                  <p className="text-sm text-destructive">{form.formState.errors.cuit.message}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">Información de Contacto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register("email")}
                  placeholder="contacto@empresa.com"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  {...form.register("telefono")}
                  placeholder="+54 341 1234567"
                />
                {form.formState.errors.telefono && (
                  <p className="text-sm text-destructive">{form.formState.errors.telefono.message}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">Ubicación</h3>
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Textarea
                id="direccion"
                {...form.register("direccion")}
                placeholder="Av. Pellegrini 1234, Rosario, Santa Fe, Argentina"
                rows={3}
              />
              {form.formState.errors.direccion && (
                <p className="text-sm text-destructive">{form.formState.errors.direccion.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-6 border-t">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isLoading ? "Guardando..." : (isEditing ? "Actualizar Proveedor" : "Crear Proveedor")}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.push("/proveedores")}
              disabled={isLoading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
