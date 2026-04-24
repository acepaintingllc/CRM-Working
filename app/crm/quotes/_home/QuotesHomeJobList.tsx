'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { KeyboardEvent } from 'react'
import type { QuotesHomeJobListVm } from './quoteHomeTypes'
import { S } from './quoteHomeStyles'

type Props = {
  vm: QuotesHomeJobListVm
  onJobQueryChange: (value: string) => void
  onSelectJob: (jobId: string) => void
  onLoadMore: () => Promise<void>
  onRetry: () => Promise<boolean>
}

export function QuotesHomeJobList({
  vm,
  onJobQueryChange,
  onSelectJob,
  onLoadMore,
  onRetry,
}: Props) {
  const handleJobOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    jobId: string
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelectJob(jobId)
      return
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    event.preventDefault()
    const optionElements = Array.from(
      event.currentTarget
        .closest('[role="listbox"]')
        ?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []
    )
    const currentIndex = optionElements.indexOf(event.currentTarget)
    if (currentIndex === -1) return

    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? optionElements.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(currentIndex + 1, optionElements.length - 1)
            : Math.max(currentIndex - 1, 0)

    optionElements[nextIndex]?.focus()
  }

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

        <div
          style={S.jobListScroll}
          aria-busy={vm.loading}
        >
          {vm.loading ? (
            <div style={S.mutedText} role="status" aria-live="polite" aria-atomic="true">
              Loading jobs...
            </div>
          ) : null}

          {!vm.loading && vm.errorMessage ? (
            <div style={S.emptyPanel} role="alert">
              <div style={S.emptyPanelTitle}>Jobs failed to load</div>
              <div style={S.bodyText}>{vm.errorMessage}</div>
              {vm.canRetry ? (
                <div style={S.rowWrap}>
                  <CrmButton onClick={() => void onRetry()} tone="primary">
                    Retry jobs
                  </CrmButton>
                </div>
              ) : null}
            </div>
          ) : null}

          {!vm.loading && vm.emptyState === 'no_matches' ? (
            <div style={S.mutedText}>No jobs match this search.</div>
          ) : null}

          {!vm.loading && !vm.errorMessage && vm.emptyState === 'no_jobs' ? (
            <div style={S.emptyPanel}>
              <div style={S.emptyPanelTitle}>No eligible jobs yet</div>
              {vm.emptyStateBody ? (
                <div style={S.bodyText}>{vm.emptyStateBody}</div>
              ) : null}
              <div style={S.rowWrap}>
                <CrmButton href="/crm/customers/new" tone="primary">
                  Add contact
                </CrmButton>
                <CrmButton href="/crm/jobs">Open jobs</CrmButton>
              </div>
            </div>
          ) : null}

          <ul
            style={S.jobListItems}
            role="listbox"
            aria-label="Jobs"
          >
            {vm.items.map((job) => (
              <li key={job.id} role="presentation">
                <button
                  id={`quote-home-job-${job.id}`}
                  type="button"
                  role="option"
                  onClick={() => onSelectJob(job.id)}
                  onKeyDown={(event) => handleJobOptionKeyDown(event, job.id)}
                  aria-selected={Boolean(job.isSelected)}
                  aria-label={`${job.title}, ${job.customerName}, ${job.versionCountLabel}${
                    job.isSelected ? ', selected' : ''
                  }`}
                  style={
                    job.isSelected ? S.selectableItemSelected : S.selectableItem
                  }
                >
                  <div style={S.itemTitleSpaced}>{job.title}</div>
                  <div style={S.itemMeta}>{job.customerName}</div>
                  <div style={S.itemMetaMono}>{job.versionCountLabel}</div>
                </button>
              </li>
            ))}
          </ul>

          {vm.hasMore ? (
            <CrmButton onClick={() => void onLoadMore()}>Load more jobs</CrmButton>
          ) : null}
        </div>
      </div>
    </CrmSectionCard>
  )
}
