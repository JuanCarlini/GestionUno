import { z } from "zod"

// Política de contraseñas, en un solo lugar (antes duplicada inline en las 3 rutas de claves).
// El máximo importa: bcrypt trunca en 72 bytes sin avisar, mejor rechazar que dar falsa fortaleza.
const MIN_CARACTERES = 12
const MAX_BYTES = 72

// Solo longitud, sin reglas de composición: es lo que recomienda el NIST SP 800-63B desde 2017
// (la composición empuja a patrones predecibles como "Password1!" sin sumar entropía real).
export const PasswordSchema = z
  .string({ required_error: "La contraseña es requerida", invalid_type_error: "La contraseña debe ser texto" })
  .min(MIN_CARACTERES, `La contraseña debe tener al menos ${MIN_CARACTERES} caracteres`)
  .refine((v) => new TextEncoder().encode(v).length <= MAX_BYTES, {
    message: `La contraseña no puede superar los ${MAX_BYTES} bytes (bcrypt trunca a partir de ahí)`,
  })

// Costo de bcrypt (12, lo que recomienda OWASP). Subirlo es retrocompatible: el costo va
// DENTRO del hash, así que los hashes viejos se siguen verificando bien.
export const BCRYPT_ROUNDS = 12
