"use client"

import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/auth-context"

// Botón "Nueva X" que solo aparece si el rol tiene `modulo:crear`. El backend igual gatea el
// POST (requirePermission); esto es solo la contraparte de UI para no mostrar algo que daría 403.
export function CrearButton({ modulo, href, label }: { modulo: string; href: string; label: string }) {
  const { puede } = useAuth()
  if (!puede(modulo, "crear")) return null

  return (
    <Button asChild>
      <Link href={href}>
        <Plus className="h-4 w-4 mr-2" />
        {label}
      </Link>
    </Button>
  )
}
