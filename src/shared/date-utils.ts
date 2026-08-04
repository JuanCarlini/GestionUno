// Un "2026-03-01" (columna date de Postgres) se parsea como fecha LOCAL: new Date(string)
// lo tomaría como medianoche UTC y en Argentina (UTC-3) se mostraría el día anterior.
export function parseFecha(valor: string): Date {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (soloFecha) {
    return new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
  }
  return new Date(valor)
}

function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === "string" ? parseFecha(date) : date
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long", 
    day: "numeric"
  }
  
  return new Intl.DateTimeFormat("es-AR", { ...defaultOptions, ...options }).format(dateObj)
}

export function formatDateShort(date: Date | string): string {
  return formatDate(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}
