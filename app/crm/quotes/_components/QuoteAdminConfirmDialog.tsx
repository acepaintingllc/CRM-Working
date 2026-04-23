'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'

type Props = {
  isOpen: boolean
  labelledBy: string
  title: string
  description: string
  closeLabel: string
  warning: string
  info?: string | null
  confirmLabel: string
  confirmingLabel?: string
  confirming?: boolean
  confirmTone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function QuoteAdminConfirmDialog({
  isOpen,
  labelledBy,
  title,
  description,
  closeLabel,
  warning,
  info = null,
  confirmLabel,
  confirmingLabel,
  confirming = false,
  confirmTone = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen) return null

  const canCancel = !confirming
  const handleCancel = () => {
    if (!canCancel) return
    onCancel()
  }

  return (
    <CrmModalShell labelledBy={labelledBy} onClose={handleCancel} widthClassName="max-w-lg">
      <CrmModalHeader
        title={title}
        description={description}
        labelledBy={labelledBy}
        onClose={handleCancel}
        closeLabel={closeLabel}
      />

      <div className="grid gap-4 px-5 py-4">
        <CrmNotice tone="warning" compact>
          {warning}
        </CrmNotice>
        {info ? (
          <CrmNotice tone="info" compact>
            {info}
          </CrmNotice>
        ) : null}
      </div>

      <div className="border-t border-[color:var(--crm-ui-border)] px-5 py-4">
        <CrmFormActions>
          <CrmButton type="button" onClick={handleCancel} disabled={!canCancel}>
            Cancel
          </CrmButton>
          <CrmButton type="button" tone={confirmTone} onClick={onConfirm} disabled={!canCancel}>
            {confirming ? confirmingLabel ?? confirmLabel : confirmLabel}
          </CrmButton>
        </CrmFormActions>
      </div>
    </CrmModalShell>
  )
}
