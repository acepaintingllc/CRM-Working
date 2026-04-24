'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { S } from './quoteHomeStyles'
import type { QuotesHomeVersionListVm } from './quoteHomeTypes'

type Props = {
  vm: QuotesHomeVersionListVm
  onLoadMore: () => Promise<unknown>
  onRetry: () => Promise<boolean>
  onRequestDelete: (estimateId: string) => void
}

export function QuotesHomeVersionList({
  vm,
  onLoadMore,
  onRetry,
  onRequestDelete,
}: Props) {
  const [retrying, setRetrying] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadMoreBusy = vm.loadingMore || loadingMore

  const handleRetry = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  const handleLoadMore = async () => {
    if (loadMoreBusy) return
    setLoadingMore(true)
    try {
      await onLoadMore()
    } finally {
      setLoadingMore(false)
    }
  }

  const renderStatus = () => {
    if (vm.status.kind === 'error') {
      return (
        <div style={S.emptyPanel} role="alert">
          <div style={S.emptyPanelTitle}>{vm.status.title}</div>
          <div style={S.bodyText}>{vm.status.message}</div>
          {vm.status.canRetry ? (
            <div style={S.rowWrap}>
              <CrmButton
                onClick={() => void handleRetry()}
                tone="primary"
                disabled={retrying}
                aria-busy={retrying}
              >
                {retrying ? vm.status.retryingLabel : vm.status.retryLabel}
              </CrmButton>
            </div>
          ) : null}
        </div>
      )
    }

    if (vm.status.kind === 'empty') {
      return <div style={S.emptyState}>{vm.status.message}</div>
    }

    return null
  }

  return (
    <CrmSectionCard
      className="self-start"
      eyebrow="Existing Versions"
      title={vm.heading}
    >
      <div style={S.grid14}>
        {vm.detail ? <div style={S.bodyText}>{vm.detail}</div> : null}

        {renderStatus()}

        {vm.items.length > 0 ? (
          <ul style={S.versionList}>
            {vm.items.map((estimate) => (
              <li key={estimate.id} style={S.versionRow}>
                <div style={S.versionSummary}>
                  <div style={S.inlineMetaRow}>
                    <div style={S.estimateTitle}>{estimate.title}</div>
                    {estimate.total ? (
                      <div style={S.versionTotal}>{estimate.total}</div>
                    ) : null}
                  </div>
                  <div style={S.estimateMeta}>{estimate.meta}</div>
                </div>
                <div style={S.rowWrapEnd}>
                  <CrmButton
                    href={estimate.href}
                    prefetch={false}
                    tone="primary"
                  >
                    Open version
                  </CrmButton>
                  <CrmButton
                    type="button"
                    tone="danger"
                    onClick={() => onRequestDelete(estimate.id)}
                    disabled={estimate.deleteDisabled}
                    aria-disabled={estimate.deleteDisabled}
                    aria-busy={estimate.deleteBusy || undefined}
                    aria-label={estimate.deleteButtonAriaLabel}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {estimate.deleteButtonLabel}
                  </CrmButton>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {vm.hasMore ? (
          <CrmButton
            type="button"
            onClick={() => void handleLoadMore()}
            disabled={loadMoreBusy}
            aria-busy={loadMoreBusy}
            aria-live="polite"
          >
            {loadMoreBusy
              ? (vm.loadingMoreLabel ?? 'Loading more versions...')
              : (vm.loadMoreLabel ?? 'Load more versions')}
          </CrmButton>
        ) : null}
      </div>
    </CrmSectionCard>
  )
}
