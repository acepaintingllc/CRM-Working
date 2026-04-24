'use client'

import { QuoteAdminConfirmDialog } from '@/app/crm/quotes/_components/QuoteAdminConfirmDialog'
import type { QuotesHomeDeleteDialogVm } from './quoteHomeTypes'

type Props = {
  vm: QuotesHomeDeleteDialogVm
  onCancel: () => void
  onConfirm: () => void
}

export function QuotesHomeDeleteDialog({ vm, onCancel, onConfirm }: Props) {
  const versionName = vm.versionName ?? 'this version'

  return (
    <QuoteAdminConfirmDialog
      isOpen={Boolean(vm.estimateId)}
      labelledBy="quote-home-delete-title"
      title="Delete version?"
      description={`Delete ${versionName} from ${vm.jobTitle ?? 'the selected job'}.`}
      closeLabel="Close delete confirmation"
      warning="This permanently deletes the quote version. This cannot be undone."
      info="The home page will refresh job counts and the selected job version list after delete."
      confirmLabel={`Delete ${versionName}`}
      confirmingLabel="Deleting..."
      confirming={vm.deleting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
