"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, User, UserPlus, KeyRound, UserX, UserCheck } from "lucide-react"
import { showSuccessToast, showErrorToast } from "@/shared/toast-helpers"
import { api } from "@/shared/api-client"
import { useAuth } from "@/components/auth-context"
import { roleLabels, roleIcons, roleColors, type UserData, type RolData } from "@/views/admin-users-shared"

interface UsuariosTabProps {
  users: UserData[]
  setUsers: Dispatch<SetStateAction<UserData[]>>
  roles: RolData[]
  refetchUsers: () => Promise<void>
  refetchRoles: () => Promise<void>
}

export function UsuariosTab({ users, setUsers, roles, refetchUsers, refetchRoles }: UsuariosTabProps) {
  const { user } = useAuth()
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [nuevo, setNuevo] = useState({ nombre: "", email: "", password: "", rol_id: "2" })
  const [resetUser, setResetUser] = useState<UserData | null>(null)
  const [resetPass, setResetPass] = useState("")
  const [saving, setSaving] = useState(false)

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId)
    try {
      await api(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rol: newRole }),
      })
      showSuccessToast("Rol actualizado")
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, rol: newRole } : u)))
      if (userId.toString() === user?.id?.toString()) {
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch (error) {
      showErrorToast("Error al actualizar rol", error instanceof Error ? error.message : "Intenta nuevamente")
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nuevo, rol_id: Number(nuevo.rol_id) }),
      })
      showSuccessToast("Usuario creado", nuevo.email)
      setNuevoOpen(false)
      setNuevo({ nombre: "", email: "", password: "", rol_id: "2" })
      await refetchUsers()
      await refetchRoles()
    } catch (error) {
      showErrorToast("Error", error instanceof Error ? error.message : "No se pudo crear el usuario")
    } finally {
      setSaving(false)
    }
  }

  const handleBaja = async (u: UserData) => {
    setUpdatingUserId(u.id)
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" })
      showSuccessToast("Usuario dado de baja", u.email)
      setUsers(prev => prev.map(x => (x.id === u.id ? { ...x, estado: "inactivo" } : x)))
    } catch (error) {
      showErrorToast("Error", error instanceof Error ? error.message : "No se pudo dar de baja")
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleReactivar = async (u: UserData) => {
    setUpdatingUserId(u.id)
    try {
      await api(`/api/admin/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "activo" }),
      })
      showSuccessToast("Usuario reactivado", u.email)
      setUsers(prev => prev.map(x => (x.id === u.id ? { ...x, estado: "activo" } : x)))
    } catch (error) {
      showErrorToast("Error", error instanceof Error ? error.message : "No se pudo reactivar")
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleResetClave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetUser) return
    setSaving(true)
    try {
      await api(`/api/admin/users/${resetUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPass }),
      })
      showSuccessToast("Clave reseteada", `Comunicale la nueva clave a ${resetUser.email}`)
      setResetUser(null)
      setResetPass("")
    } catch (error) {
      showErrorToast("Error", error instanceof Error ? error.message : "No se pudo resetear la clave")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setNuevoOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo usuario
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {users.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No hay usuarios registrados</p>
              </div>
            ) : (
              users.map((userData) => {
                const RoleIcon = roleIcons[userData.rol] || User
                const roleColor = roleColors[userData.rol] || "text-muted-foreground"
                const esUnoMismo = userData.id.toString() === user?.id?.toString()

                return (
                  <div
                    key={userData.id}
                    className={`flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors ${userData.estado === "inactivo" ? "opacity-60" : ""}`}
                  >
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <div>
                        <p className="font-medium text-foreground">{userData.nombre}</p>
                        <p className="text-sm text-muted-foreground">{userData.email}</p>
                        <div className="flex gap-1 mt-1">
                          {esUnoMismo && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Tú</span>
                          )}
                          <Badge variant={userData.estado === "activo" ? "outline" : "destructive"}>
                            {userData.estado}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <RoleIcon className={`h-5 w-5 ${roleColor} mr-2`} />
                        <span className={`font-medium ${roleColor}`}>
                          {roleLabels[userData.rol] || userData.rol}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Select
                          value={userData.rol}
                          onValueChange={(value) => handleRoleChange(userData.id, value)}
                          disabled={updatingUserId === userData.id || esUnoMismo}
                        >
                          <SelectTrigger className="w-full" aria-label={`Rol de ${userData.email}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Todos los roles del catálogo, no solo los de sistema: así los
                                roles custom (p.ej. "compras") también se pueden asignar. */}
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={r.nombre}>
                                {roleLabels[r.nombre] || r.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {updatingUserId === userData.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          title="Resetear clave"
                          aria-label={`Resetear clave de ${userData.email}`}
                          onClick={() => setResetUser(userData)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {userData.estado === "activo" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Dar de baja"
                            aria-label={`Dar de baja a ${userData.email}`}
                            disabled={esUnoMismo || updatingUserId === userData.id}
                            onClick={() => handleBaja(userData)}
                          >
                            <UserX className="h-4 w-4 text-red-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Reactivar"
                            aria-label={`Reactivar a ${userData.email}`}
                            disabled={updatingUserId === userData.id}
                            onClick={() => handleReactivar(userData)}
                          >
                            <UserCheck className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog: nuevo usuario */}
      <Dialog open={nuevoOpen} onOpenChange={setNuevoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrearUsuario} className="space-y-4">
            <div>
              <Label htmlFor="nuevo-user-nombre">Nombre *</Label>
              <Input id="nuevo-user-nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="nuevo-user-email">Email *</Label>
              <Input id="nuevo-user-email" type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="nuevo-user-pass">Contraseña inicial *</Label>
              <Input id="nuevo-user-pass" type="password" minLength={6} value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="nuevo-user-rol">Rol *</Label>
              <Select value={nuevo.rol_id} onValueChange={(v) => setNuevo({ ...nuevo, rol_id: v })}>
                <SelectTrigger id="nuevo-user-rol"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{roleLabels[r.nombre] || r.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setNuevoOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear usuario
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: reset de clave */}
      <Dialog open={resetUser !== null} onOpenChange={(open) => { if (!open) { setResetUser(null); setResetPass("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetear clave de {resetUser?.email}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetClave} className="space-y-4">
            <div>
              <Label htmlFor="reset-pass">Nueva contraseña *</Label>
              <Input id="reset-pass" type="text" minLength={6} value={resetPass} onChange={(e) => setResetPass(e.target.value)} required />
              <p className="text-xs text-muted-foreground mt-1">
                Se muestra en texto plano para que puedas comunicársela al usuario (mecanismo de recuperación de clave).
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setResetUser(null)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resetear
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
