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
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmButtonClassName } from '@/app/crm/_components/crmStyles'

import Link from 'next/link'
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
const iconSizeMd = 18

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

  const actionClassName = (action: JobWorkflowResolvedAction) => {
    if (action.tone === 'accent') {
      return crmButtonClassName('primary', 'min-h-0 rounded-[10px] px-2.5 py-1.5 text-xs')
    }
    if (action.tone === 'danger') {
      return crmButtonClassName('danger', 'min-h-0 rounded-[10px] px-2.5 py-1.5 text-xs')
    }
    return crmButtonClassName('secondary', 'min-h-0 rounded-[10px] px-2.5 py-1.5 text-xs')
  }

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
        <Link
          key={`${job.id}-${action.id}`}
          href={action.href}
          onClick={(event) => event.stopPropagation()}
          className={`${actionClassName(action)} no-underline`}
        >
          {iconLabel(Icon, action.label)}
        </Link>
      )
    }

    return (
      <button
        type="button"
        key={`${job.id}-${action.id}`}
        onClick={stop(() => {
          void runBoardAction(job, action)
        })}
        className={actionClassName(action)}
      >
        {iconLabel(Icon, action.label)}
      </button>
    )
  }

  const renderBoardActions = (job: (typeof grouped)[keyof typeof grouped][number]) => {
    const actions = getJobWorkflowActions('board', job)
    if (actions.length === 0) return null

    if (compactActions) {
      return (
        <details onClick={(event) => event.stopPropagation()}>
          <summary
            className={crmButtonClassName('secondary', 'min-h-0 rounded-[10px] px-2.5 py-1.5 text-xs')}
          >
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
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowEmptyStages((prev) => !prev)}
              aria-label={showEmptyStages ? 'Hide empty stages' : 'Show empty stages'}
              className={crmButtonClassName(showEmptyStages ? 'primary' : 'secondary')}
            >
              {iconLabel(
                ChevronDown,
                showEmptyStages ? 'Hide empty stages' : 'Show empty stages',
                iconSizeMd
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowCompleted((prev) => !prev)}
              aria-label={showCompleted ? 'Hide completed jobs' : 'Show completed jobs'}
              className={crmButtonClassName(showCompleted ? 'primary' : 'secondary')}
            >
              {iconLabel(CheckCircle2, showCompleted ? 'Hide completed' : 'Show completed', iconSizeMd)}
            </button>
            <button
              type="button"
              onClick={() => setShowLost((prev) => !prev)}
              aria-label={showLost ? 'Hide lost jobs' : 'Show lost jobs'}
              className={crmButtonClassName(showLost ? 'primary' : 'secondary')}
            >
              {iconLabel(XCircle, showLost ? 'Hide lost' : 'Show lost', iconSizeMd)}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              aria-label="Refresh jobs"
              className={crmButtonClassName('secondary')}
            >
              {iconLabel(RefreshCw, 'Refresh', iconSizeMd)}
            </button>
            <CrmButton href="/crm/jobs/new" tone="primary" className="no-underline" aria-label="Add job">
              {iconLabel(Plus, 'Add job', iconSizeMd)}
            </CrmButton>
          </>
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
                ? `repeat(${Math.max(1, visibleColumns.length)}, minmax(200px, 1fr))`
                : `repeat(${Math.max(1, visibleColumns.length)}, minmax(0, 1fr))`,
            }}
          >
            {visibleColumns.map((col) => (
              <CrmSectionCard
                key={col.key}
                className="bg-[color:var(--crm-ui-surface)]/95 p-2.5 backdrop-blur"
                title={col.title}
                badge={<CrmChip>{columnCount(col.key)}</CrmChip>}
              >
                <div className="grid gap-2">
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
                          className={crmButtonClassName(
                            'secondary',
                            'min-h-0 w-fit rounded-[10px] px-2.5 py-1.5 text-xs'
                          )}
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
                    <div
                      key={job.id}
                      onClick={() => router.push(`/crm/jobs/${job.id}`)}
                      className="ace-crm-surface cursor-pointer p-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_52px_rgba(17,24,39,0.12)]"
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

                      <div className="mt-1.5 text-xs leading-4.5 text-[color:var(--crm-ui-muted)]">
                        {job.status === 'scheduled' ? (
                          <>
                            {formatRange(job.scheduled_date, job.scheduled_end_date) ? (
                              <div>Scheduled: {formatRange(job.scheduled_date, job.scheduled_end_date)}</div>
                            ) : null}
                            {job.completed_at ? <div>Completed: {formatDate(job.completed_at)}</div> : null}
                          </>
                        ) : (
                          <>
                            {job.estimate_date ? <div>Estimate: {formatDate(job.estimate_date)}</div> : null}
                            {job.scheduled_date ? <div>Scheduled: {formatDate(job.scheduled_date)}</div> : null}
                            {job.completed_at ? <div>Completed: {formatDate(job.completed_at)}</div> : null}
                          </>
                        )}
                      </div>
                      {!compactActions && deriveJobActivitySummary(job).length > 0 ? (
                        <div className="mt-2 grid gap-1 border-t border-dashed border-[color:var(--crm-ui-border)] pt-1.5 text-[11px] text-[color:var(--crm-ui-muted)]">
                          <div className="font-bold text-[color:var(--crm-ui-text)]">Recent activity</div>
                          {deriveJobActivitySummary(job).map((item, idx) => (
                            <div key={`${job.id}-act-${idx}`}>
                              {item.label}: {formatDate(item.at)}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-1.5">{renderBoardActions(job)}</div>
                    </div>
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
