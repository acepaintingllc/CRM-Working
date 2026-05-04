'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'

const labelledBy = 'estimate-v2-unsaved-navigation-title'

export function EstimateV2UnsavedNavigationDialog({
  isOpen,
  onStay,
  onLeave,
}: {
  isOpen: boolean
  onStay: () => void
  onLeave: () => void
}) {
  if (!isOpen) return null

  return (
    <CrmModalShell labelledBy={labelledBy} onClose={onStay} widthClassName="max-w-lg">
      <CrmModalHeader
        title="Leave with unsaved changes?"
        description="This quote workspace has unsaved edits."
        labelledBy={labelledBy}
        onClose={onStay}
        closeLabel="Close unsaved changes confirmation"
      />

      <div className="grid gap-4 px-5 py-4">
        <CrmNotice tone="warning" compact>
          Leaving now will discard changes that have not been saved.
        </CrmNotice>
      </div>

      <div className="border-t border-[color:var(--crm-ui-border)] px-5 py-4">
        <CrmFormActions>
          <CrmButton type="button" onClick={onStay}>
            Stay on editor
          </CrmButton>
          <CrmButton
            type="button"
            tone="danger"
            onClick={onLeave}
            aria-label="Leave quote editor and discard unsaved changes"
          >
            Leave without saving
          </CrmButton>
        </CrmFormActions>
      </div>
    </CrmModalShell>
  )
}
