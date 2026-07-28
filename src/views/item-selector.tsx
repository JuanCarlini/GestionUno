"use client"

import { useState } from "react"
import { Item } from "@/models"
import { ItemQuickCreateDialog } from "./item-quick-create-dialog"
import { ItemCombobox } from "./item-combobox"

interface ItemSelectorProps {
  value?: number | null
  onChange: (itemId: number | null, item: Item | null) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Combobox de selección + dialog de creación rápida de items. El precio no vive en el item:
 * es por proveedor (gu_item_proveedor_precio) y se resuelve en la línea de OC.
 */
export function ItemSelector({
  value,
  onChange,
  disabled = false,
  placeholder = "Seleccionar item...",
}: ItemSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleItemCreated = (newItem: Item) => {
    // Seleccionar automáticamente el item recién creado
    onChange(newItem.id, newItem)
  }

  const handleItemChange = (itemId: number | null, item: Item | null) => {
    onChange(itemId, item)
  }

  return (
    <>
      <ItemCombobox
        value={value}
        onChange={handleItemChange}
        onCreateNew={() => setDialogOpen(true)}
        disabled={disabled}
        placeholder={placeholder}
      />

      <ItemQuickCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onItemCreated={handleItemCreated}
      />
    </>
  )
}
