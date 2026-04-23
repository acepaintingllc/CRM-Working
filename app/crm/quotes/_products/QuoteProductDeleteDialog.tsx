'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import type { QuoteProductDeleteVm } from '@/app/crm/quotes/_hooks/quoteProductsPageVm'

type Props = {
  vm: QuoteProductDeleteVm
  onConfirm: () => void
  onCancel: () => void
}

export function QuoteProductDeleteDialog({ vm, onConfirm, onCancel }: Props) {
  if (!vm.isOpen || !vm.productName) return null

  return (
    <CrmModalShell labelledBy="quote-product-delete-title" onClose={onCancel} widthClassName="max-w-lg">
      <CrmModalHeader
        title="Delete product?"
        description={`Delete ${vm.productName} from the quote products catalog.`}
        labelledBy="quote-product-delete-title"
        onClose={onCancel}
        closeLabel="Close delete confirmation"
      />

      <div className="grid gap-4 px-5 py-4">
        <CrmNotice tone="warning" compact>
          This permanently removes the product row and its admin defaults. This cannot be undone.
        </CrmNotice>
        <CrmNotice tone="info" compact>
          After delete, the editor will move to the next visible product if one exists.
        </CrmNotice>
      </div>

      <div className="border-t border-[color:var(--crm-ui-border)] px-5 py-4">
        <CrmFormActions>
          <CrmButton type="button" onClick={onCancel}>
            Cancel
          </CrmButton>
          <CrmButton type="button" tone="danger" onClick={onConfirm} disabled={vm.status === 'deleting'}>
            {vm.status === 'deleting' ? 'Deleting...' : 'Delete product'}
          </CrmButton>
        </CrmFormActions>
      </div>
    </CrmModalShell>
  )
}
