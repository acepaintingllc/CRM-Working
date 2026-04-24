'use client'

import { QuoteAdminConfirmDialog } from '@/app/crm/quotes/_components/QuoteAdminConfirmDialog'
import type { QuotesHomeDeleteDialogVm } from './quoteHomeTypes'

type Props = {
  vm: QuotesHomeDeleteDialogVm
  onCancel: () => void
  onConfirm: () => void
}

export function QuotesHomeDeleteDialog({ vm, onCancel, onConfirm }: Props) {
  return (
    <QuoteAdminConfirmDialog
      isOpen={vm.isOpen}
      labelledBy="quote-home-delete-title"
      title={vm.title}
      description={vm.description}
      closeLabel={vm.closeLabel}
      warning={vm.warning}
      info={vm.info}
      cancelLabel={vm.cancelLabel}
      cancelAriaLabel={vm.cancelAriaLabel}
      cancelDisabled={vm.cancelDisabled}
      confirmLabel={vm.confirmLabel}
      confirmAriaLabel={vm.confirmAriaLabel}
      confirmingLabel={vm.confirmingLabel}
      confirmingAriaLabel={vm.confirmingAriaLabel}
      confirming={vm.deleting}
      confirmDisabled={vm.confirmDisabled}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
