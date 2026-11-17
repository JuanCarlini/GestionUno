"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { showErrorToast } from "@/shared/toast-helpers"
import { mensajeDeError } from "@/shared/api-client"

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(mensajeDeError(data, "Error al iniciar sesión"))
      }
      
      // Recarga completa: el middleware y los server components releen la cookie de sesión.
      window.location.href = "/dashboard"
    } catch (error) {
      showErrorToast("Error", error instanceof Error ? error.message : "Verifica tus credenciales")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Iniciar sesión</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            {/* autoComplete es lo que le dice al navegador y al gestor de contraseñas qué
                campo es este. Sin eso no se puede completar la sesión guardada, y el
                navegador ofrece guardar cosas donde no van. spellCheck apagado porque un
                correo subrayado en rojo parece un error y no lo es. */}
            <Input
              id="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Iniciando…" : "Iniciar sesión"}
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            ¿Olvidaste tu contraseña o no tenés cuenta? Contactá al administrador.
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
