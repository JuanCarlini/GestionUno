"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, ShieldCheck, Plus, Trash2 } from "lucide-react"
import { showSuccessToast, showErrorToast } from "@/shared/toast-helpers"
import { api } from "@/shared/api-client"
import { RolPermisosMatrix } from "@/views/rol-permisos-matrix"
import type { RolData } from "@/views/admin-users-shared"

interface RolesTabProps {
  roles: RolData[]
  refetchRoles: () => Promise<void>
}

export function RolesTab({ roles, refetchRoles }: RolesTabProps) {
  const [nuevoRolOpen, setNuevoRolOpen] = useState(false)
  const [nuevoRol, setNuevoRol] = useState<{ nombre: string; descripcion: string; permisos: string[] }>({ nombre: "", descripcion: "", permisos: [] })
  const [editRol, setEditRol] = useState<RolData | null>(null)
  const [editPermisos, setEditPermisos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const esRolAdmin = editRol?.nombre === "admin"

  const handleCrearRol = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoRol),
      })
      showSuccessToast("Rol creado", nuevoRol.nombre)
      setNuevoRolOpen(false)
      setNuevoRol({ nombre: "", descripcion: "", permisos: [] })
      await refetchRoles()
    } catch (error) {
      showErrorToast("Error", error instanceof Error ? error.message : "No se pudo crear el rol")
    } finally {
      setSaving(false)
    }
  }

  const handleGuardarPermisos = async () => {
    if (!editRol || esRolAdmin) return
    setSaving(true)
    try {
      await api(`/api/admin/roles/${editRol.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permisos: editPermisos }),
      })
      showSuccessToast("Permisos actualizados", editRol.nombre)
      setEditRol(null)
      await refetchRoles()
    } catch (error) {
      showErrorToast("Error", error instanceof Error ? error.message : "No se pudieron guardar los permisos")
    } finally {
      setSaving(false)
    }
  }

  const handleEliminarRol = async (rol: RolData) => {
    try {
      await api(`/api/admin/roles/${rol.id}`, { method: "DELETE" })
      showSuccessToast("Rol eliminado", rol.nombre)
      await refetchRoles()
    } catch (error) {
      showErrorToast("Error", error instanceof Error ? error.message : "No se pudo eliminar el rol")
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Catálogo de roles</CardTitle>
          <Button size="sm" onClick={() => setNuevoRolOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo rol
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {roles.map((rol) => (
              <div key={rol.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{rol.nombre}</p>
                    {rol.es_sistema && <Badge variant="outline">sistema</Badge>}
                    <Badge variant="secondary">{rol.usuarios} usuario(s)</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rol.descripcion}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    title="Editar permisos"
                    aria-label={`Editar permisos de ${rol.nombre}`}
                    onClick={() => { setEditRol(rol); setEditPermisos(rol.permisos ?? []) }}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    title={rol.es_sistema ? "Los roles del sistema no se eliminan" : "Eliminar rol"}
                    aria-label={`Eliminar rol ${rol.nombre}`}
                    disabled={rol.es_sistema || rol.usuarios > 0}
                    onClick={() => handleEliminarRol(rol)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Los roles del sistema (admin, supervisor, usuario, readonly) no pueden renombrarse ni
            eliminarse. Los permisos de cada rol se asignan con la matriz (botón{" "}
            <ShieldCheck className="inline h-3 w-3 align-text-bottom" />): tildá por módulo y acción
            qué puede hacer cada rol. El rol admin tiene acceso total y no es editable.
          </p>
        </CardContent>
      </Card>

      {/* Dialog: nuevo rol */}
      <Dialog open={nuevoRolOpen} onOpenChange={setNuevoRolOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo rol</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrearRol} className="space-y-4">
            <div>
              <Label htmlFor="nuevo-rol-nombre">Nombre *</Label>
              <Input id="nuevo-rol-nombre" value={nuevoRol.nombre} onChange={(e) => setNuevoRol({ ...nuevoRol, nombre: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="nuevo-rol-desc">Descripción</Label>
              <Input id="nuevo-rol-desc" value={nuevoRol.descripcion} onChange={(e) => setNuevoRol({ ...nuevoRol, descripcion: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Permisos</Label>
              <RolPermisosMatrix
                value={nuevoRol.permisos}
                onChange={(permisos) => setNuevoRol({ ...nuevoRol, permisos })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setNuevoRolOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear rol
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar permisos de un rol */}
      <Dialog open={editRol !== null} onOpenChange={(open) => { if (!open) setEditRol(null) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Permisos de {editRol?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {esRolAdmin && (
              <p className="text-sm text-muted-foreground">
                El rol <span className="font-medium text-foreground">admin</span> tiene acceso total a
                todos los módulos y no es editable.
              </p>
            )}
            <RolPermisosMatrix
              value={editPermisos}
              onChange={setEditPermisos}
              readOnly={esRolAdmin}
            />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setEditRol(null)}>
                {esRolAdmin ? "Cerrar" : "Cancelar"}
              </Button>
              {!esRolAdmin && (
                <Button type="button" disabled={saving} onClick={handleGuardarPermisos}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar permisos
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
