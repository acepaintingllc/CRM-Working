'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/quoteHomeTypes'
import {
  estimateWorkspaceHref,
  formatDateTime,
  formatVersionState,
} from '@/app/crm/quotes/_home/quoteHomePresentation'

type QuoteCreateVersionsSectionProps = {
  items: QuoteHomeJobVersionItemReadModel[]
}

export function QuoteCreateVersionsSection({ items }: QuoteCreateVersionsSectionProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <CrmSectionCard
      eyebrow="Existing Quotes"
      title={`Existing Quotes (${items.length})`}
      description="Existing versions under this job remain available while you add the next one."
    >
      <div className="grid gap-0">
        {items.map((estimate, index) => (
          <div
            key={estimate.estimate_id}
            className={`grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
              index < items.length - 1 ? 'border-b border-[color:var(--crm-ui-border)]' : ''
            } ${index === 0 ? 'pt-0' : ''} ${index === items.length - 1 ? 'pb-0' : ''}`.trim()}
          >
            <div className="min-w-0">
              <div className="text-base font-black tracking-[-0.02em] text-[color:var(--crm-ui-text)]">
                {estimate.version_name ?? 'Quote Version'}
              </div>
              <div className="mt-1 text-sm text-[color:var(--crm-ui-muted)]">
                {formatVersionState(estimate.version_state)} / {formatVersionState(estimate.version_kind)}
              </div>
              <div className="ace-crm-mono mt-1 text-[11px] text-[color:var(--crm-ui-muted)]">
                Updated {formatDateTime(estimate.updated_at)}
              </div>
            </div>

            <CrmButton href={estimateWorkspaceHref(estimate.estimate_id)} prefetch={false}>
              Open
            </CrmButton>
          </div>
        ))}
      </div>
    </CrmSectionCard>
  )
}
