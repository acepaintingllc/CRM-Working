import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { JobReviewMetricVm } from '../_lib/jobReviewVm'

type VarianceBreakdownSectionProps = {
  metrics: JobReviewMetricVm[]
}

export function VarianceBreakdownSection({ metrics }: VarianceBreakdownSectionProps) {
  return (
    <CrmSectionCard title="Variance breakdown">
      <div className="grid gap-3">
        {metrics.map((metric) => (
          <div key={metric.key} className="ace-crm-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-black text-[color:var(--crm-ui-text)]">
                  {metric.label}
                </div>
                <div className="mt-1 text-xs text-[color:var(--crm-ui-muted)]">
                  {metric.withinToleranceLabel}
                </div>
              </div>
              <CrmChip tone={metric.tone}>{metric.variancePercent}</CrmChip>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <div>
                <dt className="ace-crm-mono text-[10px] text-[color:var(--crm-ui-muted)]">
                  Quote
                </dt>
                <dd className="font-bold text-[color:var(--crm-ui-text)]">
                  {metric.estimate}
                </dd>
              </div>
              <div>
                <dt className="ace-crm-mono text-[10px] text-[color:var(--crm-ui-muted)]">
                  Actual
                </dt>
                <dd className="font-bold text-[color:var(--crm-ui-text)]">
                  {metric.actual}
                </dd>
              </div>
              <div>
                <dt className="ace-crm-mono text-[10px] text-[color:var(--crm-ui-muted)]">
                  Variance
                </dt>
                <dd className="font-bold text-[color:var(--crm-ui-text)]">
                  {metric.variance}
                </dd>
              </div>
              <div>
                <dt className="ace-crm-mono text-[10px] text-[color:var(--crm-ui-muted)]">
                  Impact
                </dt>
                <dd className="font-bold text-[color:var(--crm-ui-text)]">
                  {metric.totalImpact}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </CrmSectionCard>
  )
}
