'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { S } from './quoteHomeStyles'
import type { QuotesHomeSelectedJobVm } from './quoteHomeTypes'

type Props = {
  vm: QuotesHomeSelectedJobVm
}

export function QuotesHomeSelectedJobPanel({ vm }: Props) {
  return (
    <CrmSectionCard
      className="self-start"
      eyebrow="Selected Job"
      actions={
        vm.jobHref ? (
          <CrmButton href={vm.jobHref} prefetch={false}>
            Open job
          </CrmButton>
        ) : null
      }
    >
      <div aria-live="polite">
        {vm.emptyMessage ? (
          <div style={S.mutedText}>{vm.emptyMessage}</div>
        ) : null}

        {vm.title ? (
          <div style={S.grid18}>
            <div style={S.grid12}>
              <div>
                <div style={S.selectedJobTitle}>{vm.title}</div>
                {vm.customerLine ? (
                  <div style={S.bodyTextStrong}>{vm.customerLine}</div>
                ) : null}
              </div>
            </div>

            <div
              className="quotes-home-selected-job-stats"
              style={S.selectedJobStatsGrid}
            >
              {vm.stats.map((stat) => (
                <div key={stat.label} style={S.selectedJobStatCard}>
                  <div style={S.selectedJobStatLabel}>{stat.label}</div>
                  <div style={S.selectedJobStatValue}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </CrmSectionCard>
  )
}
