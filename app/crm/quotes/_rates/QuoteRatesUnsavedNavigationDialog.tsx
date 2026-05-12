'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import type { QuoteRatesLeavePageVm } from '@/app/crm/quotes/_hooks/useQuoteRatesPage'

type Props = {
  vm: QuoteRatesLeavePageVm
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function QuoteRatesUnsavedNavigationDialog({
  vm,
  onSave,
  onDiscard,
  onCancel,
}: Props) {
  if (!vm.isOpen) return null

  const busy = vm.status === 'applying' || vm.saving
  const handleCancel = () => {
    if (busy) return
    onCancel()
  }

  return (
    <CrmModalShell
      labelledBy="quote-rates-unsaved-navigation-title"
      onClose={handleCancel}
      widthClassName="max-w-lg"
    >
      <CrmModalHeader
        title="Unsaved changes"
        description="You have unpublished rates, flags, or room default changes."
        labelledBy="quote-rates-unsaved-navigation-title"
        onClose={handleCancel}
        closeLabel="Close unsaved changes confirmation"
      />

      <div className="grid gap-4 px-5 py-4">
        <CrmNotice tone="warning" compact>
          Save your changes before leaving, discard them, or cancel navigation to keep editing.
        </CrmNotice>
      </div>

      <div className="border-t border-[color:var(--crm-ui-border)] px-5 py-4">
        <CrmFormActions>
          <CrmButton type="button" onClick={handleCancel} disabled={busy}>
            Cancel navigation
          </CrmButton>
          <CrmButton type="button" tone="danger" onClick={onDiscard} disabled={busy}>
            Discard changes
          </CrmButton>
          <CrmButton
            type="button"
            tone="primary"
            onClick={onSave}
            disabled={busy || !vm.canSave}
            aria-busy={vm.saving || undefined}
          >
            {vm.saving ? 'Saving...' : 'Save changes'}
          </CrmButton>
        </CrmFormActions>
      </div>
    </CrmModalShell>
  )
}
