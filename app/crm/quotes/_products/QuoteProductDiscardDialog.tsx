'use client'

import { QuoteAdminConfirmDialog } from '@/app/crm/quotes/_components/QuoteAdminConfirmDialog'
import { QuoteProductDiscardVm } from '@/app/crm/quotes/_hooks/useQuoteProductsPage'

type Props = {
  vm: QuoteProductDiscardVm
  onConfirm: () => void
  onCancel: () => void
}

function getDiscardMessage(transitionType: QuoteProductDiscardVm['transitionType']) {
  switch (transitionType) {
    case 'setActiveFamily':
      return 'Changing family will move you to a different product set and replace the current draft.'
    case 'setSearch':
      return 'Changing search can shift the selected product and replace the current draft.'
    case 'setStatusFilter':
      return 'Changing status filter can shift the selected product and replace the current draft.'
    case 'setScopeFilter':
      return 'Changing scope filter can shift the selected product and replace the current draft.'
    case 'startCreate':
      return 'Starting a new product will discard the current unsaved edits.'
    case 'setSelectedId':
    default:
      return 'Switching to another product will discard unsaved edits in the current draft.'
  }
}

export function QuoteProductDiscardDialog({ vm, onConfirm, onCancel }: Props) {
  if (!vm.isOpen || !vm.transitionType) return null

  return (
    <QuoteAdminConfirmDialog
      isOpen={vm.isOpen}
      labelledBy="quote-product-discard-title"
      title="Discard unsaved changes?"
      description="You have draft edits that are not yet saved."
      closeLabel="Close discard confirmation"
      warning={getDiscardMessage(vm.transitionType)}
      info="Choose Discard to continue and replace the draft, or Cancel to keep editing."
      confirmLabel="Discard and continue"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
