'use client'

import {
  JOB_STATUS_OPTIONS,
  getJobWorkflowActions,
  type JobWorkflowResolvedAction,
} from '@/lib/jobs/types'
import { deriveJobActivitySummary } from '@/lib/jobs/board'
import StageEmailModal from '@/app/crm/jobs/_components/StageEmailModal'
import JobCompletionCloseoutModal from '@/app/crm/jobs/_components/JobCompletionCloseoutModal'
import { useJobsBoardPage } from '@/app/crm/jobs/_hooks/useJobsBoardPage'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmDenseActionRow } from '@/app/crm/_components/CrmDenseActionRow'
import { CrmDenseMetaList } from '@/app/crm/_components/CrmDenseMetaList'
import { CrmDenseSectionHeader } from '@/app/crm/_components/CrmDenseSectionHeader'
import { CrmDenseSurfaceCard } from '@/app/crm/_components/CrmDenseSurfaceCard'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'

import { useRouter } from 'next/navigation'
import type { MouseEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Mail,
  Plus,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react'

const iconSizeSm = 16
const headerActionClassName =
  'min-h-0 justify-center rounded-[10px] px-2.5 py-1.5 text-xs max-[420px]:px-2 max-[420px]:text-[11px] sm:min-h-11 sm:px-4 sm:py-2 sm:text-sm'

function iconLabel(Icon: LucideIcon, label: string, size = iconSizeSm) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

export default function JobsPage() {
  const router = useRouter()
  const {
    loading,
    error,
    notice,
    completedQuery,
    setCompletedQuery,
    showAllCompleted,
    setShowAllCompleted,
    showCompleted,
    setShowCompleted,
    showLost,
    setShowLost,
    showEmptyStages,
    setShowEmptyStages,
    compactActions,
    emailJobId,
    emailStage,
    closeoutJobId,
    grouped,
    filteredCompleted,
    visibleColumns,
    load,
    runBoardAction,
    closeStageEmail,
    handleStageEmailSent,
    closeCloseout,
    handleCloseoutSaved,
  } = useJobsBoardPage()

  const formatDate = (iso: string | null) => {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  const formatRange = (start: string | null | undefined, end: string | null | undefined) => {
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`
    if (start) return formatDate(start)
    if (end) return formatDate(end)
    return null
  }

  const stop =
    (fn: () => void) =>
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      fn()
    }

  const columnCount = (status: (typeof JOB_STATUS_OPTIONS)[number]['value']) => grouped[status].length

  const actionTone = (action: JobWorkflowResolvedAction) =>
    action.tone === 'accent' ? 'primary' : action.tone === 'danger' ? 'danger' : 'secondary'
  const boardColumns = compactActions
    ? visibleColumns.filter((column) => column.key !== 'follow_up')
    : visibleColumns

  const actionIcon = (action: JobWorkflowResolvedAction) => {
    switch (action.id) {
      case 'review_send_quote':
      case 'edit_send_quote':
      case 'mark_quote_sent':
        return Send
      case 'set_quote_date':
        return CalendarClock
      case 'schedule_job':
      case 'change_scheduled_date':
        return CalendarCheck
      case 'move_to_follow_up':
      case 'send_follow_up':
      case 'send_scheduled_email':
      case 'open_closeout':
        return Mail
      case 'mark_completed':
        return CheckCircle2
      case 'mark_lost':
        return XCircle
      default:
        return Mail
    }
  }

  const renderBoardAction = (
    job: (typeof grouped)[keyof typeof grouped][number],
    action: JobWorkflowResolvedAction
  ) => {
    const Icon = actionIcon(action)
    if (action.kind === 'navigate' && action.href) {
      return (
        <CrmButton
          key={`${job.id}-${action.id}`}
          href={action.href}
          onClick={(event) => event.stopPropagation()}
          tone={actionTone(action)}
          className="min-h-0 rounded-[10px] px-2.5 py-1.5 text-xs no-underline"
        >
          {iconLabel(Icon, action.label)}
        </CrmButton>
      )
    }

    return (
      <CrmButton
        type="button"
        key={`${job.id}-${action.id}`}
        onClick={stop(() => {
          void runBoardAction(job, action)
        })}
        tone={actionTone(action)}
        className="min-h-0 rounded-[10px] px-2.5 py-1.5 text-xs"
      >
        {iconLabel(Icon, action.label)}
      </CrmButton>
    )
  }

  const renderBoardActions = (job: (typeof grouped)[keyof typeof grouped][number]) => {
    const actions = getJobWorkflowActions('board', job)
    if (actions.length === 0) return null

    if (compactActions) {
      return (
        <details onClick={(event) => event.stopPropagation()}>
          <summary className="ace-crm-btn ace-crm-btn-secondary min-h-0 rounded-[10px] px-2.5 py-1.5 text-xs">
            {iconLabel(ChevronDown, 'More')}
          </summary>
          <div className="mt-1.5 grid gap-1.5">
            {actions.map((action) => renderBoardAction(job, action))}
          </div>
        </details>
      )
    }

    return actions.map((action) => renderBoardAction(job, action))
  }

  return (
    <CrmPageShell className="max-w-[2000px]">
      <CrmPageHeader
        eyebrow="Pipeline board"
        emoji="🛠️"
        title="Jobs"
        description="Track every job through your pipeline from estimate to completion with one operational board."
        badge={<CrmChip tone="accent">Board workflow</CrmChip>}
        className="max-sm:px-3 max-sm:py-3 max-sm:[&_.ace-crm-mono]:text-[9px] max-sm:[&_.ace-crm-surface-muted]:h-8 max-sm:[&_.ace-crm-surface-muted]:w-8 max-sm:[&_.ace-crm-surface-muted]:text-base max-sm:[&_h1]:text-[1.45rem] max-sm:[&_h1]:tracking-normal max-sm:[&_p]:hidden"
        actions={
          <div className="grid w-full grid-cols-2 gap-1.5 min-[420px]:grid-cols-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2">
            <CrmButton
              type="button"
              onClick={() => setShowEmptyStages((prev) => !prev)}
              aria-label={showEmptyStages ? 'Hide empty stages' : 'Show empty stages'}
              tone={showEmptyStages ? 'primary' : 'secondary'}
              className={headerActionClassName}
            >
              {iconLabel(
                ChevronDown,
                showEmptyStages ? 'Hide empty stages' : 'Show empty stages',
                iconSizeSm
              )}
            </CrmButton>
            <CrmButton
              type="button"
              onClick={() => setShowCompleted((prev) => !prev)}
              aria-label={showCompleted ? 'Hide completed jobs' : 'Show completed jobs'}
              tone={showCompleted ? 'primary' : 'secondary'}
              className={headerActionClassName}
            >
              {iconLabel(CheckCircle2, showCompleted ? 'Hide completed' : 'Show completed', iconSizeSm)}
            </CrmButton>
            <CrmButton
              type="button"
              onClick={() => setShowLost((prev) => !prev)}
              aria-label={showLost ? 'Hide lost jobs' : 'Show lost jobs'}
              tone={showLost ? 'primary' : 'secondary'}
              className={headerActionClassName}
            >
              {iconLabel(XCircle, showLost ? 'Hide lost' : 'Show lost', iconSizeSm)}
            </CrmButton>
            <CrmButton
              type="button"
              onClick={() => void load()}
              aria-label="Refresh jobs"
              tone="secondary"
              className={headerActionClassName}
            >
              {iconLabel(RefreshCw, 'Refresh', iconSizeSm)}
            </CrmButton>
            <CrmButton
              href="/crm/jobs/new"
              tone="primary"
              className={`${headerActionClassName} no-underline`}
              aria-label="Add job"
            >
              {iconLabel(Plus, 'Add job', iconSizeSm)}
            </CrmButton>
          </div>
        }
      />

      {error ? <CrmNotice tone="error" emoji="⚠️">{error}</CrmNotice> : null}
      {notice ? <CrmNotice tone="success" emoji="✨">{notice}</CrmNotice> : null}

      {loading ? (
        <CrmSectionCard title="Loading jobs" emoji="⏳">
          <p className="text-sm text-[color:var(--crm-ui-muted)]">Refreshing the pipeline board.</p>
        </CrmSectionCard>
      ) : (
        <div className={`pb-2 ${compactActions ? 'overflow-x-auto' : ''}`}>
          <div
            className={`grid gap-3 ${compactActions ? 'min-w-max' : ''}`}
            style={{
              gridTemplateColumns: compactActions
                ? `repeat(${Math.max(1, boardColumns.length)}, minmax(200px, 1fr))`
                : `repeat(${Math.max(1, boardColumns.length)}, minmax(0, 1fr))`,
            }}
          >
            {boardColumns.map((col) => (
              <CrmSectionCard
                key={col.key}
                className="bg-[color:var(--crm-ui-surface)]/95 p-2.5 backdrop-blur"
              >
                <div className="grid gap-2">
                  <CrmDenseSectionHeader title={col.title} badge={<CrmChip>{columnCount(col.key)}</CrmChip>} />
                  {col.key === 'completed' ? (
                    <div className="grid gap-2">
                      <CrmSearchBar
                        value={completedQuery}
                        onChange={setCompletedQuery}
                        placeholder="Search completed..."
                      />
                      {!completedQuery && grouped.completed.length > 5 ? (
                        <button
                          type="button"
                          onClick={() => setShowAllCompleted((prev) => !prev)}
                          className="ace-crm-btn ace-crm-btn-secondary min-h-0 w-fit rounded-[10px] px-2.5 py-1.5 text-xs"
                        >
                          {showAllCompleted ? 'Show last 5' : 'Show all'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {(col.key === 'completed' ? filteredCompleted : grouped[col.key]).length === 0 ? (
                    <CrmEmptyState
                      className="shadow-none"
                      emoji="📭"
                      title="No jobs in this stage"
                      description={
                        col.key === 'estimate_scheduled'
                          ? 'New jobs will appear here after creation.'
                          : 'Jobs move here automatically as status changes.'
                      }
                    />
                  ) : null}

                  {(col.key === 'completed' ? filteredCompleted : grouped[col.key]).map((job) => (
                    <CrmDenseSurfaceCard
                      key={job.id}
                      className="cursor-pointer"
                      interactive
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/crm/jobs/${job.id}`)}
                        className="grid w-full gap-0 text-left"
                      >
                      <div className="text-base leading-tight font-extrabold text-[color:var(--crm-ui-text)] break-words">
                        {job.title}
                      </div>
                      <div className="mt-0.5 text-xs text-[color:var(--crm-ui-muted)]">
                        {job.customer_name ? job.customer_name : `Customer: ${job.customer_id}`}
                      </div>

                      {job.description ? (
                        <div className="mt-1.5 text-xs text-[color:var(--crm-ui-text)]">
                          {job.description}
                        </div>
                      ) : null}

                      <CrmDenseMetaList
                        className="mt-2"
                        items={[
                          ...(job.status === 'scheduled'
                            ? [
                                {
                                  label: 'Scheduled',
                                  value: formatRange(job.scheduled_date, job.scheduled_end_date) ?? '-',
                                },
                                {
                                  label: 'Completed',
                                  value: formatDate(job.completed_at) ?? '-',
                                },
                              ]
                            : [
                                { label: 'Estimate', value: formatDate(job.estimate_date) ?? '-' },
                                { label: 'Scheduled', value: formatDate(job.scheduled_date) ?? '-' },
                                { label: 'Completed', value: formatDate(job.completed_at) ?? '-' },
                              ]),
                        ]}
                      />
                      {!compactActions && deriveJobActivitySummary(job).length > 0 ? (
                        <div className="mt-2 grid gap-1 border-t border-dashed border-[color:var(--crm-ui-border)] pt-2 text-[11px] text-[color:var(--crm-ui-muted)]">
                          <div className="font-bold text-[color:var(--crm-ui-text)]">Recent activity</div>
                          {deriveJobActivitySummary(job).map((item, idx) => (
                            <div key={`${job.id}-act-${idx}`}>
                              {item.label}: {formatDate(item.at)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      </button>
                      <CrmDenseActionRow className="mt-3" data-testid={`job-card-actions-${job.id}`}>
                        {renderBoardActions(job)}
                      </CrmDenseActionRow>
                    </CrmDenseSurfaceCard>
                  ))}
                </div>
              </CrmSectionCard>
            ))}
          </div>
        </div>
      )}
      <StageEmailModal
        jobId={emailJobId}
        stage={emailStage}
        open={emailStage != null && emailJobId != null}
        onClose={closeStageEmail}
        onSent={handleStageEmailSent}
      />
      <JobCompletionCloseoutModal
        jobId={closeoutJobId}
        open={closeoutJobId != null}
        onClose={closeCloseout}
        onSaved={handleCloseoutSaved}
      />
    </CrmPageShell>
  )
}
