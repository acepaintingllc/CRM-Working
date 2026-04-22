'use client'

import Link from 'next/link'
import { useJobDetailPage } from '@/app/crm/jobs/_hooks/useJobDetailPage'
import StageEmailModal from '@/app/crm/jobs/_components/StageEmailModal'
import JobCompletionCloseoutModal from '@/app/crm/jobs/_components/JobCompletionCloseoutModal'
import JobActionRail from '@/app/crm/jobs/[id]/_components/JobActionRail'
import JobCloseoutPanel from '@/app/crm/jobs/[id]/_components/JobCloseoutPanel'
import JobDetailHeader from '@/app/crm/jobs/[id]/_components/JobDetailHeader'
import JobDetailsPanel from '@/app/crm/jobs/[id]/_components/JobDetailsPanel'
import JobTimeline from '@/app/crm/jobs/[id]/_components/JobTimeline'
import {
  jobsButtonDangerClassName,
  jobsButtonSecondaryClassName,
  jobsButtonSmallClassName,
} from '@/lib/jobs/uiClasses'
import {
  JOB_STATUS_OPTIONS,
  getJobWorkflowActions,
  type JobWorkflowResolvedAction,
} from '@/lib/jobs/types'
import { ArrowLeft, type LucideIcon } from 'lucide-react'

const iconSizeMd = 18

function iconLabel(Icon: LucideIcon, label: string, size = iconSizeMd) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

export default function JobDetailPage() {
  const {
    id,
    router,
    job,
    loading,
    error,
    notice,
    deleting,
    emailStage,
    closeoutOpen,
    timelineOpen,
    setTimelineOpen,
    estimateFile,
    estimateFileError,
    paintLogs,
    afterPhotos,
    sitePhotos,
    copy,
    patchJob,
    deleteJob,
    openStageEmail,
    openCloseout,
    closeStageEmail,
    closeCloseout,
    handleStageEmailSent,
    handleCloseoutSaved,
    handleStatusChange,
    markCompletedAndPrompt,
    formatDate,
    formatRange,
    formatStatus,
  } = useJobDetailPage()

  const detailActions = job ? getJobWorkflowActions('detail', job) : []

  const actionClassName = (action: JobWorkflowResolvedAction) => {
    if (action.tone === 'accent') {
      return 'inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--crm-accent)] bg-[var(--crm-accent)] px-2.5 py-2 text-xs font-bold text-[var(--crm-accent-text)] transition hover:opacity-95'
    }
    if (action.tone === 'danger') {
      return jobsButtonDangerClassName
    }
    return jobsButtonSmallClassName
  }

  const runDetailAction = async (action: JobWorkflowResolvedAction) => {
    if (!job) return
    if (action.confirmMessage && !window.confirm(action.confirmMessage)) return
    if (action.kind === 'navigate' && action.href) {
      router.push(action.href)
      return
    }
    if (action.kind === 'stage_email' && action.stage) {
      openStageEmail(action.stage)
      return
    }
    if (action.kind === 'patch_status' && action.status) {
      await handleStatusChange(action.status)
      return
    }
    if (action.kind === 'open_closeout') {
      openCloseout()
      return
    }
    if (action.kind === 'patch_date' && action.dateField === 'completed_at') {
      await markCompletedAndPrompt()
      return
    }
    if (action.kind === 'patch_date' && action.dateField === 'estimate_sent_at') {
      await patchJob({ estimate_sent_at: new Date().toISOString() })
      return
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <JobDetailHeader
          title={job?.title ?? 'Job details'}
          status={job?.status ?? null}
          statusOptions={JOB_STATUS_OPTIONS}
          deleting={deleting}
          onBack={() => router.back()}
          onDelete={() => void deleteJob()}
          onStatusChange={(status) => void handleStatusChange(status)}
          formatStatus={formatStatus}
          deleteButtonClassName={jobsButtonDangerClassName}
        />

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {loading && <div className="text-gray-500">Loading job...</div>}
          {!loading && error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-white p-3 text-red-800">
              {error}
            </div>
          )}
          {!loading && notice && (
            <div className="mt-3 rounded-xl border border-green-200 bg-white p-3 text-green-700">
              {notice}
            </div>
          )}
          {!loading && !error && !job && <div className="text-gray-500">Job not found.</div>}

          {!loading && job && (
            <div className="mt-3 flex flex-wrap items-start gap-5">
              <div className="min-w-0 flex-[1_1_420px]">
                <JobDetailsPanel
                  job={job}
                  estimateFile={estimateFile}
                  estimateFileError={estimateFileError}
                  actionButtonClassName={jobsButtonSecondaryClassName}
                  onCopy={(label, value) => void copy(label, value)}
                />
                <JobCloseoutPanel
                  job={job}
                  paintLogs={paintLogs}
                  afterPhotos={afterPhotos}
                  sitePhotos={sitePhotos}
                  detailActions={detailActions}
                  formatDate={formatDate}
                />
                <JobActionRail
                  actions={detailActions}
                  getActionClassName={actionClassName}
                  onAction={(action) => void runDetailAction(action)}
                />
              </div>

              <div className="w-full max-w-full flex-[0_0_300px]">
                <JobTimeline
                  job={job}
                  open={timelineOpen}
                  onToggle={() => setTimelineOpen((prev) => !prev)}
                  onEstimateDateChange={(iso) => void patchJob({ estimate_date: iso })}
                  formatDate={formatDate}
                  formatRange={formatRange}
                />
              </div>
            </div>
          )}
        </div>

        <Link
          href="/crm/jobs"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-black bg-black px-3 py-2 text-sm font-semibold text-white no-underline transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-black/80"
        >
          {iconLabel(ArrowLeft, 'Back to jobs', iconSizeMd)}
        </Link>

        <StageEmailModal
          jobId={typeof id === 'string' ? id : null}
          stage={emailStage}
          open={emailStage != null}
          onClose={closeStageEmail}
          onSent={handleStageEmailSent}
        />
        <JobCompletionCloseoutModal
          jobId={typeof id === 'string' ? id : null}
          open={closeoutOpen}
          onClose={closeCloseout}
          onSaved={(result) => void handleCloseoutSaved(result)}
        />
      </div>
    </div>
  )
}
