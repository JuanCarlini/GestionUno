import * as React from "react"

const CONSULTA = "(prefers-reduced-motion: reduce)"

/**
 * `true` cuando el sistema pide menos movimiento.
 *
 * Existe para las animaciones que no se pueden apagar desde CSS: las de Recharts son JS
 * y solo se desactivan por prop (`isAnimationActive`). Todo lo demás —overlays, spinner,
 * skeletons, scroll— ya se resuelve en globals.css y no necesita este hook.
 *
 * A diferencia de useIsMobile, el valor inicial se lee sincrónico en vez de resolverse en
 * el efecto: una animación de entrada ocurre una sola vez, y si el primer render dice
 * "animá" ya es tarde para desdecirse. En el servidor no hay matchMedia, así que arranca
 * en false; los gráficos se montan recién cuando llegan los datos del cliente.
 */
export function useReducedMotion() {
  const [reducido, setReducido] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia(CONSULTA).matches
  )

  React.useEffect(() => {
    const mql = window.matchMedia(CONSULTA)
    const onChange = () => setReducido(mql.matches)
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return reducido
}
