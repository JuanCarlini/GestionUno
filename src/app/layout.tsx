import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Gestión Uno",
  description: "ERP de control de compras y pagos",
}

// Los valores son los de --background de globals.css, uno por tema. Sin esto, en un
// teléfono la barra del navegador se queda con su gris por defecto y corta contra la app:
// se nota sobre todo en oscuro, donde queda una franja clara arriba de una app oscura.
//
// Va en el export `viewport` y no en `metadata` porque Next 15 avisa si themeColor está en
// metadata. No se toca `viewport-fit`: en auto el navegador ya mete el contenido adentro
// del área segura, que es lo que queremos en una app que no es a sangre ni es PWA.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#111518" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
