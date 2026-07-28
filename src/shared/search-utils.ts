// Función de búsqueda con score (relevancia)
export function searchWithScore<T>(
  items: T[], 
  searchTerm: string, 
  fields: (keyof T)[],
  weights?: Partial<Record<keyof T, number>>
): T[] {
  if (!searchTerm.trim()) {
    return items
  }

  const normalizedSearch = searchTerm.toLowerCase().trim()
  const defaultWeight = 1

  const itemsWithScore = items.map(item => {
    let score = 0
    
    fields.forEach(field => {
      const value = item[field]
      const weight = weights?.[field] ?? defaultWeight
      
      if (value != null) {
        const stringValue = value instanceof Date 
          ? value.toLocaleDateString() 
          : value.toString().toLowerCase()
        
        if (stringValue.includes(normalizedSearch)) {
          // Bonus por coincidencia exacta
          if (stringValue === normalizedSearch) {
            score += weight * 10
          }
          // Bonus por empezar con el término
          else if (stringValue.startsWith(normalizedSearch)) {
            score += weight * 5
          }
          // Coincidencia normal
          else {
            score += weight
          }
        }
      }
    })
    
    return { item, score }
  })
  
  return itemsWithScore
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}