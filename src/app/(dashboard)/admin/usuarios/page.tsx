"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando usuarios...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Administración de Usuarios</h1>
        <p className="text-muted-foreground mt-2">
          Alta, baja, roles y claves de los usuarios del sistema
        </p>
      </div>

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
