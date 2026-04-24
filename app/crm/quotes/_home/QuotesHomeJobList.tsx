'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { QuotesHomeJobListVm } from './quoteHomeTypes'
import { S } from './quoteHomeStyles'

type Props = {
  vm: QuotesHomeJobListVm
  onJobQueryChange: (value: string) => void
  onSelectJob: (jobId: string) => void
}

export function QuotesHomeJobList({
  vm,
  onJobQueryChange,
  onSelectJob,
}: Props) {
  return (
    <CrmSectionCard className="self-start" eyebrow="Jobs">
      <div style={S.grid16}>
        <input
          value={vm.searchQuery}
          onChange={(event) => onJobQueryChange(event.target.value)}
          placeholder="Search jobs by title, customer, or address"
          aria-label="Search jobs"
          className="ace-crm-input text-sm"
        />

        <div style={S.jobListScroll}>
          {vm.loading ? <div style={S.mutedText}>Loading jobs...</div> : null}

          {!vm.loading && vm.emptyState === 'no_matches' ? (
            <div style={S.mutedText}>No jobs match this search.</div>
          ) : null}

          {!vm.loading && vm.emptyState === 'no_jobs' ? (
            <div style={S.emptyPanel}>
              <div style={S.emptyPanelTitle}>No eligible jobs yet</div>
              <div style={S.bodyText}>
                Quote creation starts from a job with a linked customer. Add
                the contact first, then create the job in the normal CRM flow.
              </div>
              <div style={S.rowWrap}>
                <CrmButton href="/crm/customers/new" tone="primary">
                  Add contact
                </CrmButton>
                <CrmButton href="/crm/jobs">Open jobs</CrmButton>
              </div>
            </div>
          ) : null}

          {vm.items.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => onSelectJob(job.id)}
              aria-pressed={Boolean(job.isSelected)}
              style={
                job.isSelected ? S.selectableItemSelected : S.selectableItem
              }
            >
              <div style={S.itemTitleSpaced}>{job.title}</div>
              <div style={S.itemMeta}>{job.customerName}</div>
              <div style={S.itemMetaMono}>{job.versionCountLabel}</div>
            </button>
          ))}
        </div>
      </div>
    </CrmSectionCard>
  )
}
