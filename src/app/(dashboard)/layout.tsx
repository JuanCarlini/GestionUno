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
        {/* El primer tab de cada pantalla. Quien navega con teclado o lector de pantalla
            entra por el menú, que tiene ocho links y se repite igual en todas las páginas:
            sin esto hay que pasar por los ocho antes de llegar al contenido, en cada
            pantalla. Invisible hasta que recibe el foco, y ahí aparece arriba a la
            izquierda. El menú ya es un landmark de navegación con nombre, así que entre
            los dos se puede ir a cualquiera de las dos partes directo. */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Saltar al contenido
        </a>
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
          {/* h-14 en vez de py-3: el alto de la barra es un número, no el resultado de lo
              que haya adentro. Con py-3 dependía del control más alto, así que cambiar un
              botón del header movía el alto de la barra en todas las pantallas. */}
          <header className="chrome-translucida sticky top-0 z-30 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6 flex items-center justify-between">
            {/* h-9 w-9: el default del componente es h-7 (28px) y al lado convivían dos
                controles de 36px, tres alturas distintas en la misma barra. */}
            <SidebarTrigger className="h-9 w-9" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          {/* tabIndex -1: el destino de un salto tiene que poder recibir el foco, si no el
              navegador mueve el scroll pero el foco se queda donde estaba y el siguiente
              tab vuelve al menú. */}
          <div id="contenido" tabIndex={-1} className="flex-1 p-4 md:p-6 focus:outline-none">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </AuthProvider>
  )
}
