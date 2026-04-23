'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
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
    <CrmModalShell labelledBy="quote-product-discard-title" onClose={onCancel} widthClassName="max-w-lg">
      <CrmModalHeader
        title="Discard unsaved changes?"
        description="You have draft edits that are not yet saved."
        labelledBy="quote-product-discard-title"
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
