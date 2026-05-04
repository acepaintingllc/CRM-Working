import { Lock, Save, Send } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { JobReviewVm } from '../_lib/jobReviewVm'

type ReviewSummarySectionProps = {
  vm: JobReviewVm
  saving: boolean
  reviewing: boolean
  locking: boolean
  isReadOnly: boolean
  saveDraft: () => Promise<boolean>
  markReviewed: () => Promise<boolean>
  lock: () => Promise<boolean>
}

export function ReviewSummarySection({
  vm,
  saving,
  reviewing,
  locking,
  isReadOnly,
  saveDraft,
  markReviewed,
  lock,
}: ReviewSummarySectionProps) {
  const busy = saving || reviewing || locking

  return (
    <CrmSectionCard
      title={vm.versionName}
      eyebrow={`Accepted ${vm.acceptedAt}`}
      badge={
        <div className="flex flex-wrap gap-2">
          <CrmChip tone={vm.statusTone}>{vm.statusLabel}</CrmChip>
          <CrmChip tone={vm.trendEligibleTone}>{vm.trendEligibleLabel}</CrmChip>
          <CrmChip tone={vm.dataQualityTone}>{vm.dataQualityLabel}</CrmChip>
          <CrmChip tone={vm.exclusionTone}>{vm.exclusionLabel}</CrmChip>
          <CrmChip tone={vm.changeOrderTone}>{vm.changeOrderLabel}</CrmChip>
        </div>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <CrmButton
            type="button"
            tone="secondary"
            onClick={() => void saveDraft()}
            disabled={busy || isReadOnly}
          >
            <Save size={15} aria-hidden="true" />
            <span>{saving ? 'Saving...' : 'Save draft'}</span>
          </CrmButton>
          <CrmButton
            type="button"
            tone="primary"
            onClick={() => void markReviewed()}
            disabled={busy || isReadOnly}
          >
            <Send size={15} aria-hidden="true" />
            <span>{reviewing ? 'Saving...' : 'Mark reviewed'}</span>
          </CrmButton>
          <CrmButton
            type="button"
            tone="danger"
            onClick={() => void lock()}
            disabled={busy || isReadOnly}
          >
            <Lock size={15} aria-hidden="true" />
            <span>{locking ? 'Locking...' : 'Lock review'}</span>
          </CrmButton>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        {vm.kpis.map((kpi) => (
          <div key={kpi.id} className="ace-crm-surface-muted p-3">
            <div className="ace-crm-mono text-[10px] font-bold text-[color:var(--crm-ui-muted)]">
              {kpi.label}
            </div>
            <div className="mt-2 text-xl font-black text-[color:var(--crm-ui-text)]">
              {kpi.value}
            </div>
            <div className="mt-1 text-xs text-[color:var(--crm-ui-muted)]">
              {kpi.detail}
            </div>
          </div>
        ))}
      </div>

      {vm.hasUnsavedTrendEligibilityChanges ? (
        <div className="mt-4">
          <CrmNotice tone="warning" compact>
            {vm.trendEligibilityDetail}
          </CrmNotice>
        </div>
      ) : null}

      {isReadOnly ? (
        <div className="mt-4">
          <CrmNotice tone="info" compact>
            Locked reviews are read-only. Metrics and review classifications are frozen.
          </CrmNotice>
        </div>
      ) : null}
    </CrmSectionCard>
  )
}
