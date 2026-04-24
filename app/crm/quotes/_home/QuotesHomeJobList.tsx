'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { QuotesHomeJobListVm } from './quoteHomeTypes'
import { S } from './quoteHomeStyles'
import { buildQuotesHomeJobListStatusFromVm } from './quoteHomePresentation'

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
  const [loadingMore, setLoadingMore] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const selectedJobOptionId = vm.items.some((job) => job.id === vm.selectedJobId)
    ? `quote-home-job-${vm.selectedJobId}`
    : undefined

  const handleLoadMore = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      await onLoadMore()
    } finally {
      setLoadingMore(false)
    }
  }

  const handleRetry = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }
  const status = vm.status ?? buildQuotesHomeJobListStatusFromVm(vm)

  const renderStatus = () => {
    if (status.kind === 'loading') {
      return (
        <div style={S.mutedText} role="status" aria-live="polite" aria-atomic="true">
          {status.message}
        </div>
      )
    }

    if (status.kind === 'error') {
      return (
        <div style={S.emptyPanel} role="alert">
          <div style={S.emptyPanelTitle}>{status.title}</div>
          <div style={S.bodyText}>{status.message}</div>
          {status.canRetry ? (
            <div style={S.rowWrap}>
              <CrmButton
                onClick={() => void handleRetry()}
                tone="primary"
                disabled={retrying}
                aria-busy={retrying}
              >
                {retrying ? status.retryingLabel : status.retryLabel}
              </CrmButton>
            </div>
          ) : null}
        </div>
      )
    }

    if (status.kind === 'empty' && status.emptyState === 'no_matches') {
      return <div style={S.mutedText}>{status.title}</div>
    }

    if (status.kind === 'empty') {
      return (
        <div style={S.emptyPanel}>
          <div style={S.emptyPanelTitle}>{status.title}</div>
          {status.body ? (
            <div style={S.bodyText}>{status.body}</div>
          ) : null}
          <div style={S.rowWrap}>
            <CrmButton href="/crm/customers/new" tone="primary">
              Add contact
            </CrmButton>
            <CrmButton href="/crm/jobs">Open jobs</CrmButton>
          </div>
        </div>
      )
    }

    return null
  }

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
          {renderStatus()}

          <ul
            style={S.jobListItems}
            role="listbox"
            aria-label="Jobs"
            aria-activedescendant={selectedJobOptionId}
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
                  aria-current={job.isSelected ? 'true' : undefined}
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
            <CrmButton
              onClick={() => void handleLoadMore()}
              disabled={loadingMore}
              aria-busy={loadingMore}
              aria-live="polite"
            >
              {loadingMore
                ? (vm.loadingMoreLabel ?? 'Loading more jobs...')
                : (vm.loadMoreLabel ?? 'Load more jobs')}
            </CrmButton>
          ) : null}
        </div>
      </div>
    </CrmSectionCard>
  )
}
