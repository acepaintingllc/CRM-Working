import type { ReactNode } from 'react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'

type CrmEntityFormPageProps = {
  title: string
  description?: string
  error?: string | null
  notice?: string | null
  validationError?: string | null
  actions?: ReactNode | null
  children: ReactNode
  saveLabel: string
  savingLabel: string
  saving?: boolean
  canSave?: boolean
  onSave?: () => void
}

export function CrmEntityFormPage({
  title,
  description,
  error,
  notice,
  validationError,
  actions,
  children,
  saveLabel,
  savingLabel,
  saving = false,
  canSave = true,
  onSave,
}: CrmEntityFormPageProps) {
  return (
    <CrmSectionCard
      title={title}
      description={description}
        actions={
        actions !== undefined ? actions : (
          <CrmButton type="button" onClick={onSave} disabled={!canSave} tone="primary">
            {saving ? savingLabel : saveLabel}
          </CrmButton>
        )
      }
    >
      {error ? <CrmNotice tone="error" compact>{error}</CrmNotice> : null}
      {notice ? <CrmNotice tone="success" compact>{notice}</CrmNotice> : null}
      {validationError ? <CrmNotice tone="info" compact>{validationError}</CrmNotice> : null}
      {children}
    </CrmSectionCard>
  )
}
