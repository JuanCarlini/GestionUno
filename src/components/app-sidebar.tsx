"use client"

import { BarChart3, Building2, CreditCard, ShoppingCart, Home, FileCheck, Receipt, Shield, LogOut, ClipboardList } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/components/auth-context"
import { isAdmin, stringToUserRole } from "@/shared/permissions"
import { Button } from "@/components/ui/button"

// `modulo` = clave de la matriz; si está, el item solo se muestra con permiso `ver`.
// Dashboard y Reportes no son módulos de matriz → siempre visibles.
const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Órdenes de Compra", url: "/ordenes-compra", icon: ShoppingCart, modulo: "ordenes_compra" },
  { title: "Certificaciones", url: "/certificaciones", icon: FileCheck, modulo: "certificaciones" },
  { title: "Facturas", url: "/facturas", icon: Receipt, modulo: "facturas" },
  { title: "Órdenes de Pago", url: "/ordenes-pago", icon: CreditCard, modulo: "ordenes_pago" },
  { title: "Proveedores", url: "/proveedores", icon: Building2, modulo: "proveedores" },
  { title: "Reportes", url: "/reportes", icon: BarChart3 },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, puede } = useAuth()

  const userRole = user ? stringToUserRole(user.rol) : null
  const userIsAdmin = userRole ? isAdmin(userRole) : false

  // Solo los módulos que el rol puede ver (Dashboard/Reportes no llevan módulo → siempre).
  const visibles = menuItems.filter((item) => !item.modulo || puede(item.modulo, "ver"))

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }

  return (
    <Sidebar className="border-border">
      <SidebarHeader className="border-b border-border p-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">G1</span>
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Gestión Uno</h2>
            <p className="text-xs text-muted-foreground">Sistema de Gestión</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground font-medium">
            Menú Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibles.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`text-muted-foreground hover:bg-accent hover:text-foreground ${
                        isActive ? "bg-muted text-foreground font-medium" : ""
                      }`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sección de Administración - Solo para admins */}
        {userIsAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-destructive font-medium">
              Administración
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className={`text-muted-foreground hover:bg-destructive/10 hover:text-destructive ${
                      pathname === "/admin/usuarios" ? "bg-destructive/10 text-destructive font-medium" : ""
                    }`}
                  >
                    <Link href="/admin/usuarios">
                      <Shield className="h-4 w-4" />
                      <span>Gestión de Usuarios</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className={`text-muted-foreground hover:bg-destructive/10 hover:text-destructive ${
                      pathname === "/admin/auditoria" ? "bg-destructive/10 text-destructive font-medium" : ""
                    }`}
                  >
                    <Link href="/admin/auditoria">
                      <ClipboardList className="h-4 w-4" />
                      <span>Auditoría</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <div className="space-y-2">
          {user && (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{user.nombre}</p>
              <p>{user.email}</p>
              <p className="text-muted-foreground">Rol: {user.rol}</p>
            </div>
          )}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
