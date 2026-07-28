const esDev = process.env.NODE_ENV === "development"

const __dirname = dirname(fileURLToPath(import.meta.url))

const esDev = process.env.NODE_ENV === "development"

// Cabeceras de seguridad: el proyecto no tenía ninguna.
// Por qué importan acá: la sesión va en cookie y la app ejecuta acciones de dinero
// (aprobar OC, marcar OP como pagada) que son de un solo click — el escenario de
// clickjacking de manual. Y sin CSP no hay red de contención ante un XSS futuro.
//
// La CSP se relaja en desarrollo: el HMR de Next necesita eval() y un websocket.
// En producción no lleva ninguna de las dos.
const csp = [
  "default-src 'self'",
  // 'unsafe-inline': Next inyecta los scripts de hidratación inline. Sacarlo requiere
  // migrar a nonce por request desde el middleware — vale hacerlo, pero es otro cambio.
  `script-src 'self' 'unsafe-inline'${esDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'", // Tailwind y Radix inyectan estilos inline
  "img-src 'self' data: blob:",
  "font-src 'self'", // next/font self-hostea Inter en build time: no hace falta Google
  `connect-src 'self'${esDev ? " ws: wss:" : ""}`, // el browser NUNCA habla con Supabase: todo pasa por /api
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", // anti-clickjacking (el moderno; X-Frame-Options es el fallback)
  "frame-src 'none'",
  ...(esDev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // HSTS solo en producción: en local se sirve por http y un max-age acá dejaría
  // el navegador del desarrollador forzando https contra localhost.
  ...(esDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Raíz para el rastreo de archivos: evita que Next tome un lockfile de un directorio
  // superior cuando hay más de uno en el árbol.
  outputFileTracingRoot: __dirname,
  eslint: {
    ignoreDuringBuilds: false, // ✅ Habilitar ESLint warnings
  },
  typescript: {
    ignoreBuildErrors: false, // ✅ Habilitar TypeScript errors
  },
  images: {
    unoptimized: true,
  },
  poweredByHeader: false, // no anunciar el framework
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
