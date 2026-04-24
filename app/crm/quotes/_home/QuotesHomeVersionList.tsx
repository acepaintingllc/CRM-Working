'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { Trash2 } from 'lucide-react'
import { S } from './quoteHomeStyles'
import type { QuotesHomeVersionListVm } from './quoteHomeTypes'

type Props = {
  vm: QuotesHomeVersionListVm
  onLoadMore: () => void
  onRequestDelete: (estimateId: string) => void
}

export function QuotesHomeVersionList({ vm, onLoadMore, onRequestDelete }: Props) {
  return (
    <CrmSectionCard
      className="self-start"
      eyebrow="Existing Versions"
      title={vm.heading}
    >
      <div style={S.grid14}>
        {vm.detail ? <div style={S.bodyText}>{vm.detail}</div> : null}

        {vm.emptyMessage ? (
          <div style={S.emptyState}>{vm.emptyMessage}</div>
        ) : null}

        {vm.items.map((estimate) => (
          <div key={estimate.id} style={S.versionRow}>
            <div>
              <div style={S.inlineMetaRow}>
                <div style={S.estimateTitle}>{estimate.title}</div>
                {estimate.total ? (
                  <div style={S.versionTotal}>{estimate.total}</div>
                ) : null}
              </div>
              <div style={S.estimateMeta}>{estimate.meta}</div>
            </div>
            <div style={S.rowWrapEnd}>
              <CrmButton href={estimate.href} prefetch={false} tone="primary">
                Open version
              </CrmButton>
              <CrmButton
                type="button"
                tone="danger"
                onClick={() => onRequestDelete(estimate.id)}
                disabled={estimate.deleting}
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete
              </CrmButton>
            </div>
          </div>
        ))}

        {vm.hasMore ? (
          <CrmButton type="button" onClick={onLoadMore} disabled={vm.loadingMore}>
            {vm.loadingMore ? 'Loading more versions...' : 'Load more versions'}
          </CrmButton>
        ) : null}
      </div>
    </CrmSectionCard>
  )
}
