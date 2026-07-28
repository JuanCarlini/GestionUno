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
        <main className="flex-1 flex flex-col min-h-screen bg-background">
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-3 flex items-center justify-between">
            <SidebarTrigger />
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <UserMenu userName="Admin" />
            </div>
          </header>
          <div className="flex-1 p-6">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </AuthProvider>
  )
}
