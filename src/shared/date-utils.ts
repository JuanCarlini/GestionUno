export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === "string" ? new Date(date) : date
  
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
