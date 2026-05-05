'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'

const labelledBy = 'estimate-v2-unsaved-navigation-title'

export function EstimateV2UnsavedNavigationDialog({
  isOpen,
  canSave,
  onStay,
  onSave,
  onLeave,
}: {
  isOpen: boolean
  canSave: boolean
  onStay: () => void
  onSave: () => void
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
          Save your changes before leaving, discard them, or cancel navigation to keep editing.
        </CrmNotice>
      </div>

      <div className="border-t border-[color:var(--crm-ui-border)] px-5 py-4">
        <CrmFormActions>
          <CrmButton type="button" onClick={onStay}>
            Cancel
          </CrmButton>
          <CrmButton type="button" onClick={onSave} disabled={!canSave}>
            Save and leave
          </CrmButton>
          <CrmButton
            type="button"
            tone="danger"
            onClick={onLeave}
            aria-label="Discard changes and leave quote editor"
          >
            Discard and leave
          </CrmButton>
        </CrmFormActions>
      </div>
    </CrmModalShell>
  )
}
