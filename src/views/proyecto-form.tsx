"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { showErrorToast, showSuccessToast } from "@/shared/toast-helpers"
import {
  CreateProyectoSchema,
  LABEL_PROYECTO_ESTADO,
  PROYECTO_ESTADOS,
  UpdateProyectoSchema,
  type CreateProyecto,
  type UpdateProyecto,
} from "@/shared/validation/proyecto-validation"
import type { Proyecto } from "@/models/proyecto.model"

type Props = { proyecto?: Proyecto }

export function ProyectoForm({ proyecto }: Props) {
  const isEditing = Boolean(proyecto)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<CreateProyecto & Partial<UpdateProyecto>>({
    resolver: zodResolver(isEditing ? UpdateProyectoSchema : CreateProyectoSchema),
    defaultValues: {
      nombre: proyecto?.nombre ?? "",
      codigo: proyecto?.codigo ?? "",
      descripcion: proyecto?.descripcion ?? "",
      fecha_inicio: proyecto?.fecha_inicio ?? "",
      fecha_fin: proyecto?.fecha_fin ?? "",
      ...(isEditing ? { estado: proyecto?.estado ?? "planificado" } : {}),
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(
        isEditing ? `/api/proyectos/${proyecto!.id}` : "/api/proyectos",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      )

      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}))
        throw new Error(cuerpo.error ?? `Error ${res.status}`)
      }

      showSuccessToast(isEditing ? "Proyecto actualizado" : "Proyecto creado")
      router.push("/proyectos")
      router.refresh()
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "Error desconocido"
      setError(mensaje)
      showErrorToast(mensaje)
    } finally {
      setIsLoading(false)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar proyecto" : "Datos del proyecto"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" {...form.register("nombre")} />
              {form.formState.errors.nombre && (
                <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" {...form.register("codigo")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha_inicio">Fecha de inicio</Label>
              <Input id="fecha_inicio" type="date" {...form.register("fecha_inicio")} />
              {form.formState.errors.fecha_inicio && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.fecha_inicio.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha_fin">Fecha de cierre</Label>
              <Input id="fecha_fin" type="date" {...form.register("fecha_fin")} />
            </div>

            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Select
                  value={form.watch("estado")}
                  onValueChange={(v) =>
                    form.setValue("estado", v as UpdateProyecto["estado"], { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROYECTO_ESTADOS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {LABEL_PROYECTO_ESTADO[e]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea id="descripcion" rows={3} {...form.register("descripcion")} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Guardar cambios" : "Crear proyecto"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
