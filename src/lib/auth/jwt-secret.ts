// Fuente única del secreto JWT. Uno adivinable anula TODA la autorización, por eso se valida
// fuerza mínima. Se lee en request (no al importar): un throw a nivel módulo rompe `next build`.

const LONGITUD_MINIMA = 32

// Heurístico deliberado (no un medidor de entropía): atrapa placeholders y secretos derivados
// del nombre del proyecto. La defensa de fondo es generar el secreto con `crypto.randomBytes(32)`.
const PALABRAS_PREVISIBLES = /gestion|soma|changeme|password|clave|secreto|supersecret|example|placeholder/i

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error(
      "JWT_SECRET no está configurada. Definila en .env.local / variables de entorno del deploy."
    )
  }

  if (secret.length < LONGITUD_MINIMA) {
    throw new Error(
      `JWT_SECRET debe tener al menos ${LONGITUD_MINIMA} caracteres. ` +
        `Generá uno con: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
    )
  }

  if (PALABRAS_PREVISIBLES.test(secret)) {
    throw new Error(
      "JWT_SECRET contiene una palabra previsible (nombre del proyecto o placeholder). " +
        `Generá uno aleatorio con: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
    )
  }

  return secret
}
