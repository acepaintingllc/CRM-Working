'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { Trash2 } from 'lucide-react'
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
  return (
    <CrmSectionCard
      className="self-start"
      eyebrow="Existing Versions"
      title={vm.heading}
    >
      <div style={S.grid14}>
        {vm.detail ? <div style={S.bodyText}>{vm.detail}</div> : null}

        {vm.errorMessage ? (
          <div style={S.emptyPanel} role="alert">
            <div style={S.emptyPanelTitle}>Versions failed to load</div>
            <div style={S.bodyText}>{vm.errorMessage}</div>
            {vm.canRetry ? (
              <div style={S.rowWrap}>
                <CrmButton onClick={() => void onRetry()} tone="primary">
                  Retry versions
                </CrmButton>
              </div>
            ) : null}
          </div>
        ) : null}

        {!vm.errorMessage && vm.emptyMessage ? (
          <div style={S.emptyState}>{vm.emptyMessage}</div>
        ) : null}

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
                    disabled={estimate.deleting}
                    aria-label={`Delete quote version ${estimate.title}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Delete
                  </CrmButton>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {vm.hasMore ? (
          <CrmButton
            type="button"
            onClick={() => void onLoadMore()}
            disabled={vm.loadingMore}
            aria-busy={vm.loadingMore}
            aria-live="polite"
          >
            {vm.loadingMore ? 'Loading more versions...' : 'Load more versions'}
          </CrmButton>
        ) : null}
      </div>
    </CrmSectionCard>
  )
}
