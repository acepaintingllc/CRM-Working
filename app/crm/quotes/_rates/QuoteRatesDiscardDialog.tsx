'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import type { QuoteRatesDiscardVm } from '@/app/crm/quotes/_hooks/useQuoteRatesPage'

type Props = {
  vm: QuoteRatesDiscardVm
  onConfirm: () => void
  onCancel: () => void
}

function getDiscardMessage(transitionType: QuoteRatesDiscardVm['transitionType']) {
  switch (transitionType) {
    case 'setActiveTab':
      return 'Changing tabs will replace the current unsaved draft.'
    case 'setRateSection':
      return 'Changing sections will move you to a different rate group and replace the current draft.'
    case 'setRateCategory':
      return 'Changing the subgroup will replace the current unsaved draft.'
    case 'setFlagsSection':
      return 'Changing the flags section will replace the current unsaved draft.'
    case 'setRoomDefaultsSection':
      return 'Changing the room-defaults section will replace the current unsaved draft.'
    case 'setStatusFilter':
      return 'Changing the status filter can shift the selected row and replace the current draft.'
    case 'setSearch':
      return 'Changing search can shift the selected row and replace the current draft.'
    case 'startCreate':
      return 'Starting a new row will discard the current unsaved edits.'
    case 'startDuplicate':
      return 'Duplicating a row will discard the current unsaved edits.'
    case 'reload':
      return 'Refreshing will reload the current rows and replace the unsaved draft.'
    case 'archiveOrReactivate':
      return 'Changing row status will reload the current rows and replace the unsaved draft.'
    case 'setSelectedId':
    default:
      return 'Switching to another row will discard unsaved edits in the current draft.'
  }
}

export function QuoteRatesDiscardDialog({ vm, onConfirm, onCancel }: Props) {
  if (!vm.isOpen || !vm.transitionType) return null

  return (
    <CrmModalShell labelledBy="quote-rates-discard-title" onClose={onCancel} widthClassName="max-w-lg">
      <CrmModalHeader
        title="Discard unsaved changes?"
        description="You have draft edits that are not yet saved."
        labelledBy="quote-rates-discard-title"
        onClose={onCancel}
        closeLabel="Close discard confirmation"
      />

      <div className="grid gap-4 px-5 py-4">
        <CrmNotice tone="warning" compact>
          {getDiscardMessage(vm.transitionType)}
        </CrmNotice>
        <CrmNotice tone="info" compact>
          Choose Discard to continue and replace the draft, or Cancel to keep editing.
        </CrmNotice>
      </div>

      <div className="border-t border-[color:var(--crm-ui-border)] px-5 py-4">
        <CrmFormActions>
          <CrmButton type="button" onClick={onCancel}>
            Cancel
          </CrmButton>
          <CrmButton type="button" tone="danger" onClick={onConfirm}>
            Discard and continue
          </CrmButton>
        </CrmFormActions>
      </div>
    </CrmModalShell>
  )
}
