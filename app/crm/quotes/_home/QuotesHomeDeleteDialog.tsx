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
  const jobTitle = vm.jobTitle ?? 'the selected job'

  return (
    <QuoteAdminConfirmDialog
      isOpen={vm.isOpen ?? Boolean(vm.estimateId)}
      labelledBy="quote-home-delete-title"
      title={vm.title ?? 'Delete version?'}
      description={vm.description ?? `Delete ${versionName} from ${jobTitle}.`}
      closeLabel={vm.closeLabel ?? 'Close delete confirmation'}
      warning={
        vm.warning ??
        'This permanently deletes the quote version. This cannot be undone.'
      }
      info={
        vm.info ??
        'The home page will refresh job counts and the selected job version list after delete.'
      }
      confirmLabel={vm.confirmLabel ?? `Delete ${versionName}`}
      confirmingLabel={vm.confirmingLabel ?? 'Deleting...'}
      confirming={vm.deleting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
