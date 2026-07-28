"use client"

import { useFormContext } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

// Muestra el error de nivel formulario (form.setError("root", ...)) que usan los forms del
// circuito para las validaciones de dominio (líneas, imputaciones, sumas) y los errores de
// red del submit. Lee el estado por contexto → va adentro de <Form {...form}>, sin props.
export function FormRootError() {
  const { formState } = useFormContext()
  const message = formState.errors.root?.message
  if (!message) return null
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message as string}</AlertDescription>
    </Alert>
  )
}
