import Link from "next/link"

// not-found global: una URL que no existe, fuera del dashboard. Sin layout propio (no hay
// sesión garantizada acá), así que se maqueta solo.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="text-6xl font-bold tabular-nums text-muted-foreground">404</p>
        <h1 className="text-xl font-semibold text-foreground">Esta página no existe</h1>
        <p className="text-muted-foreground">
          Puede que el enlace esté mal escrito o que la pantalla ya no esté.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 motion-reduce:transition-none"
        >
          Ir al inicio
        </Link>
      </div>
    </main>
  )
}
