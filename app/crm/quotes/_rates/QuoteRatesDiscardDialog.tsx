'use client'

import { QuoteAdminConfirmDialog } from '@/app/crm/quotes/_components/QuoteAdminConfirmDialog'
import type { QuoteRatesDiscardVm } from '@/app/crm/quotes/_hooks/useQuoteRatesPage'

type Props = {
  vm: QuoteRatesDiscardVm
  onConfirm: () => void
  onCancel: () => void
}

function getDiscardMessage(transitionType: QuoteRatesDiscardVm['transitionType']) {
  switch (transitionType) {
    case 'setActiveTab':
      return 'Changing tabs will replace the current unsaved row edits.'
    case 'setRateSection':
      return 'Changing sections will move you to a different rate group and replace the current row edits.'
    case 'setRateCategory':
      return 'Changing the subgroup will replace the current unsaved row edits.'
    case 'setFlagsSection':
      return 'Changing the flags section will replace the current unsaved row edits.'
    case 'setRoomDefaultsSection':
      return 'Changing the room-defaults section will replace the current unsaved row edits.'
    case 'setStatusFilter':
      return 'Changing the status filter can shift the selected row and replace the current row edits.'
    case 'setSearch':
      return 'Changing search can shift the selected row and replace the current row edits.'
    case 'startCreate':
      return 'Starting a new row will discard the current unsaved edits.'
    case 'startDuplicate':
      return 'Duplicating a row will discard the current unsaved edits.'
    case 'reload':
      return 'Refreshing will reload the current rows and replace unsaved row edits.'
    case 'archiveOrReactivate':
      return 'Changing row status will replace unsaved row edits.'
    case 'setSelectedId':
    default:
      return 'Switching to another row will discard unsaved edits in the current row.'
  }
}

export function QuoteRatesDiscardDialog({ vm, onConfirm, onCancel }: Props) {
  if (!vm.isOpen || !vm.transitionType) return null

  return (
    <QuoteAdminConfirmDialog
      isOpen={vm.isOpen}
      labelledBy="quote-rates-discard-title"
      title="Discard unsaved changes?"
      description="You have row edits that are not yet staged."
      closeLabel="Close discard confirmation"
      warning={getDiscardMessage(vm.transitionType)}
      info="Choose Discard to continue and replace the row edits, or Cancel to keep editing."
      confirmLabel="Discard and continue"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
