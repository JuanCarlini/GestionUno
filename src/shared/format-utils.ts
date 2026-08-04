export function formatCurrency(amount: number, currency = "ARS"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", 
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount)
}
