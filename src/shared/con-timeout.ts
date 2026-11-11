/**
 * Corre una promesa contra un reloj. Ni el SDK de Supabase ni el de Storage tienen timeout
 * propio: si el servicio se cuelga, la request queda colgada hasta que la mate la plataforma
 * y el usuario se queda sin respuesta.
 *
 * El reloj se limpia siempre (finally), si no un timer pendiente mantiene el proceso vivo.
 */
export async function conTimeout<T>(operacion: Promise<T>, ms: number): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined
  const vencido = new Promise<never>((_, reject) => {
    reloj = setTimeout(() => reject(new Error("timeout")), ms)
  })
  try {
    return await Promise.race([operacion, vencido])
  } finally {
    clearTimeout(reloj)
  }
}
