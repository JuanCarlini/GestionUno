"use client"

import { BarChart3, Building2, CreditCard, ShoppingCart, Home, FileCheck, FolderKanban, Receipt, Shield, LogOut, ClipboardList } from "lucide-react"
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

// `módulo` = clave de la matriz; si está, el item solo se muestra con permiso `ver`.
// Dashboard no es módulo de matriz → siempre visible. Reportes sí lo es desde el
// rediseño: se catea con reportes:ver como cualquier otra sección.
const menuItems = [
  { title: "Inicio", url: "/dashboard", icon: Home },
  { title: "Órdenes de Compra", url: "/ordenes-compra", icon: ShoppingCart, modulo: "ordenes_compra" },
  { title: "Certificaciones", url: "/certificaciones", icon: FileCheck, modulo: "certificaciones" },
  { title: "Facturas", url: "/facturas", icon: Receipt, modulo: "facturas" },
  { title: "Órdenes de Pago", url: "/ordenes-pago", icon: CreditCard, modulo: "ordenes_pago" },
  { title: "Proveedores", url: "/proveedores", icon: Building2, modulo: "proveedores" },
  { title: "Proyectos", url: "/proyectos", icon: FolderKanban, modulo: "proyectos" },
  { title: "Reportes", url: "/reportes", icon: BarChart3, modulo: "reportes" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, puede } = useAuth()

  const userRole = user ? stringToUserRole(user.rol) : null
  const userIsAdmin = userRole ? isAdmin(userRole) : false

  // Solo los módulos que el rol puede ver (Dashboard no lleva módulo → siempre visible).
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
      {/* role + aria-label en vez de envolver en un <nav>: SidebarContent ya reenvía props a
          su div, así que el landmark queda sin meter un elemento de más que rompa el flex.
          Es el único bloque de navegación de la app; el logo y el botón de salir quedan
          afuera a propósito. */}
      <SidebarContent role="navigation" aria-label="Navegación principal">
        <SidebarGroup>
          <SidebarGroupLabel>Menú principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibles.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    {/* isActive, que es la prop del componente, en vez de clases propias: el
                        hover y el estado activo ya los dibuja SidebarMenuButton con los
                        tokens --sidebar-*, que son los que están tintados al hue de marca.
                        Las clases que había acá (bg-accent, bg-muted, text-muted-foreground)
                        pisaban esa paleta con los tokens globales, así que las 16 variables
                        --sidebar-* estaban definidas y no se veían en ningún lado. */}
                    <SidebarMenuButton asChild isActive={isActive}>
                      {/* aria-current: el fondo gris dice cuál es la página actual a quien la
                          ve. Sin esto, quien usa lector de pantalla no tiene cómo saberlo. */}
                      <Link href={item.url} aria-current={isActive ? "page" : undefined}>
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sección de Administración - Solo para admins.

            Sin rojo: el rojo es el color de "esto rompe algo" y navegar no rompe nada. Con
            la etiqueta y los items en destructive, a un admin le quedaba toda su navegación
            pintada de advertencia, y el hover de cada link se leía como un botón de borrar.
            Lo que separa esta sección es ser un grupo aparte con su propio título y el ícono
            del escudo, no el color. */}
        {userIsAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin/usuarios"}>
                    <Link
                      href="/admin/usuarios"
                      aria-current={pathname === "/admin/usuarios" ? "page" : undefined}
                    >
                      <Shield className="h-4 w-4" aria-hidden="true" />
                      <span>Gestión de Usuarios</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin/auditoria"}>
                    <Link
                      href="/admin/auditoria"
                      aria-current={pathname === "/admin/auditoria" ? "page" : undefined}
                    >
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
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
            <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
            Cerrar Sesión
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
