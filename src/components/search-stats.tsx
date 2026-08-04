"use client"

import { Badge } from "@/components/ui/badge"

interface SearchStatsProps {
  totalItems: number
  filteredItems: number
  searchTerm: string
  entityName: string
}

export function SearchStats({ totalItems, filteredItems, searchTerm, entityName }: SearchStatsProps) {
  if (!searchTerm && filteredItems === totalItems) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-4">
      {searchTerm && (
        <>
          <span>Búsqueda:</span>
          <Badge variant="secondary" className="font-normal max-w-[200px] truncate">
            &ldquo;{searchTerm}&rdquo;
          </Badge>
        </>
      )}
      <span>
        Mostrando {filteredItems} de {totalItems} {entityName}
        {totalItems !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
