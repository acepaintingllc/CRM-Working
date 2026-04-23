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
      title="Delete product?"
      description={`Delete ${vm.productName} from the quote products catalog.`}
      closeLabel="Close delete confirmation"
      warning="This permanently removes the product row and its admin defaults. This cannot be undone."
      info="After delete, the editor will move to the next visible product if one exists."
      confirmLabel="Delete product"
      confirmingLabel="Deleting..."
      confirming={vm.status === 'deleting'}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
