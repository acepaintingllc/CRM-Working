'use client'

import { QuoteAdminConfirmDialog } from '@/app/crm/quotes/_components/QuoteAdminConfirmDialog'
import type { QuoteProductDeleteVm } from '@/app/crm/quotes/_hooks/useQuoteProductsPage'

type Props = {
  vm: QuoteProductDeleteVm
  onConfirm: () => void
  onCancel: () => void
}

export function QuoteProductDeleteDialog({ vm, onConfirm, onCancel }: Props) {
  if (!vm.isOpen || !vm.productName) return null

  return (
    <QuoteAdminConfirmDialog
      isOpen={vm.isOpen}
      labelledBy="quote-product-delete-title"
      title="Archive product?"
      description={`Archive ${vm.productName} in the quote products catalog.`}
      closeLabel="Close archive confirmation"
      warning="Archived products remain available for historical quotes and references, but are excluded from active defaults."
      info="If the archived product is hidden by the current filter, the editor will move to the next visible product."
      confirmLabel="Archive product"
      confirmingLabel="Archiving..."
      confirming={vm.status === 'deleting'}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
