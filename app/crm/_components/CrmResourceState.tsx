import type { ReactNode } from 'react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'

type CrmResourceStateProps = {
  loading?: boolean
  error?: string | null
  hasData?: boolean
  loadingTitle?: string
  loadingDescription?: string
  emptyTitle?: string
  emptyDescription?: string
  errorTitle?: string
  retryLabel?: string
  onRetry?: (() => void) | null
  children?: ReactNode
}

export function CrmResourceState({
  loading = false,
  error = null,
  hasData = false,
  loadingTitle = 'Loading',
  loadingDescription = 'Loading data...',
  emptyTitle,
  emptyDescription,
  errorTitle = 'Unable to load resource',
  retryLabel = 'Retry',
  onRetry = null,
  children,
}: CrmResourceStateProps) {
  if (loading && !hasData) {
    return (
      <CrmSectionCard title={loadingTitle}>
        <p className="text-sm text-[color:var(--crm-ui-muted)]">{loadingDescription}</p>
      </CrmSectionCard>
    )
  }

  if (error && !hasData) {
    return (
      <CrmSectionCard title={errorTitle}>
        <CrmNotice tone="error">{error}</CrmNotice>
        {onRetry ? (
          <div className="mt-4">
            <CrmButton type="button" onClick={onRetry}>
              {retryLabel}
            </CrmButton>
          </div>
        ) : null}
      </CrmSectionCard>
    )
  }

  if (!hasData && emptyTitle) {
    return <CrmEmptyState title={emptyTitle} description={emptyDescription ?? ''} />
  }

  return <>{children}</>
}
