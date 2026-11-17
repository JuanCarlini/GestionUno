import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"
import { AuthProvider } from "@/components/auth-context"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
        {/* min-w-0: sin esto, un hijo ancho (tabla, tabs) estira el main más allá
            del viewport en vez de scrollear dentro de su propio contenedor. */}
        <main className="flex-1 min-w-0 flex flex-col min-h-screen bg-background">
          {/* sticky: sin esto el header se iba con el scroll y el material translúcido no
              hacía nada —el blur y el bg/60 necesitan que algo pase por detrás—. Con la
              barra fija, además, los controles de arriba quedan al alcance en un listado
              largo, que es la pantalla donde más se scrollea.

              z-30 lo pone arriba del contenido y del sidebar fijo de escritorio (z-10) y
              debajo del overlay del drawer y de los dialogs (z-50), que tienen que taparlo. */}
          <header className="chrome-translucida sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6 py-3 flex items-center justify-between">
            {/* h-9 w-9: el default del componente es h-7 (28px) y al lado convivían dos
                controles de 36px, tres alturas distintas en la misma barra. */}
            <SidebarTrigger className="h-9 w-9" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserMenu userName="Admin" />
            </div>
          </header>
          <div className="flex-1 p-4 md:p-6">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </AuthProvider>
  )
}
