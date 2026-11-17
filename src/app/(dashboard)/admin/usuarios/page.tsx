"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import { PageHeaderSkeleton, UsuariosSkeleton } from "@/components/skeletons"
import { showErrorToast } from "@/shared/toast-helpers"
import { api } from "@/shared/api-client"
import { UsuariosTab } from "@/views/admin-usuarios-tab"
import { RolesTab } from "@/views/admin-roles-tab"
import type { UserData, RolData } from "@/views/admin-users-shared"

// Shell de la administración de usuarios: datos compartidos (usuarios + roles) y las dos tabs.
// El acceso lo gatea (dashboard)/admin/layout.tsx server-side con requirePageAdmin().
export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [roles, setRoles] = useState<RolData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchUsers(), fetchRoles()]).finally(() => setLoading(false))
  }, [])

  const fetchUsers = async () => {
    try {
      setUsers(await api("/api/admin/users"))
    } catch {
      showErrorToast("Error", "No se pudieron cargar los usuarios")
    }
  }

  const fetchRoles = async () => {
    try {
      setRoles(await api("/api/admin/roles"))
    } catch {
      showErrorToast("Error", "No se pudieron cargar los roles")
    }
  }

  // La misma composición que loading.tsx mientras resuelve la ruta. Antes acá había un
  // spinner centrado en una tarjeta, así que al entrar se veían tres layouts seguidos: el
  // skeleton de la ruta, el spinner, y recién después la pantalla. Con lo mismo de los dos
  // lados, la transición es una sola y no salta.
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton conAccion={false} />
        <UsuariosSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración de Usuarios"
        description="Alta, baja, roles y claves de los usuarios del sistema"
      />

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuarios ({users.length})</TabsTrigger>
          <TabsTrigger value="roles">Roles ({roles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <UsuariosTab
            users={users}
            setUsers={setUsers}
            roles={roles}
            refetchUsers={fetchUsers}
            refetchRoles={fetchRoles}
          />
        </TabsContent>

        <TabsContent value="roles">
          <RolesTab roles={roles} refetchRoles={fetchRoles} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
