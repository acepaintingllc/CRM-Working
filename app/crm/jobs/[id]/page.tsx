'use client'

import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useJobDetailPage } from '@/app/crm/jobs/_hooks/useJobDetailPage'
import StageEmailModal from '@/app/crm/jobs/_components/StageEmailModal'
import JobCompletionCloseoutModal from '@/app/crm/jobs/_components/JobCompletionCloseoutModal'
import JobActionRail from '@/app/crm/jobs/[id]/_components/JobActionRail'
import JobCloseoutPanel from '@/app/crm/jobs/[id]/_components/JobCloseoutPanel'
import JobDetailHeader from '@/app/crm/jobs/[id]/_components/JobDetailHeader'
import JobDetailsPanel from '@/app/crm/jobs/[id]/_components/JobDetailsPanel'
import JobTimeline from '@/app/crm/jobs/[id]/_components/JobTimeline'
import {
  JOB_STATUS_OPTIONS,
  getJobWorkflowActions,
  type JobWorkflowResolvedAction,
} from '@/lib/jobs/types'

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

  const actionTone = (action: JobWorkflowResolvedAction) =>
    action.tone === 'accent' ? 'primary' : action.tone === 'danger' ? 'danger' : 'secondary'

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
    }
  }

  return (
    <CrmPageShell className="max-w-6xl">
      <CrmPageHeader
        eyebrow="Pipeline workflow"
        emoji="🧾"
        title={job?.title ?? 'Job details'}
        description="Shared CRM job detail page with workflow actions, schedule context, and closeout data."
        backHref="/crm/jobs"
        backLabel="Back to jobs"
      />

      <JobDetailHeader
        title={job?.title ?? 'Job details'}
        status={job?.status ?? null}
        statusOptions={JOB_STATUS_OPTIONS}
        deleting={deleting}
        onBack={() => router.back()}
        onDelete={() => void deleteJob()}
        onStatusChange={(status) => void handleStatusChange(status)}
        formatStatus={formatStatus}
      />

      {loading ? (
        <CrmSectionCard title="Loading job">
          <div className="text-[color:var(--crm-ui-muted)]">Loading job...</div>
        </CrmSectionCard>
      ) : null}
      {!loading && error ? <CrmNotice tone="error">{error}</CrmNotice> : null}
      {!loading && notice ? <CrmNotice tone="success">{notice}</CrmNotice> : null}
      {!loading && !error && !job ? (
        <CrmSectionCard title="Job not found">
          <div className="text-[color:var(--crm-ui-muted)]">Job not found.</div>
        </CrmSectionCard>
      ) : null}

      {!loading && job ? (
        <CrmDetailLayout
          main={
            <>
              <CrmSectionCard title="Details">
                <JobDetailsPanel
                  job={job}
                  estimateFile={estimateFile}
                  estimateFileError={estimateFileError}
                  onCopy={(label, value) => void copy(label, value)}
                />
              </CrmSectionCard>
              <CrmSectionCard title="Closeout">
                <JobCloseoutPanel
                  job={job}
                  paintLogs={paintLogs}
                  afterPhotos={afterPhotos}
                  sitePhotos={sitePhotos}
                  detailActions={detailActions}
                  formatDate={formatDate}
                />
              </CrmSectionCard>
              <CrmSectionCard title="Actions" variant="compact">
                <JobActionRail
                  actions={detailActions}
                  getActionTone={actionTone}
                  onAction={(action) => void runDetailAction(action)}
                />
              </CrmSectionCard>
            </>
          }
          side={
            <CrmSectionCard title="Timeline" variant="rail">
              <JobTimeline
                job={job}
                open={timelineOpen}
                onToggle={() => setTimelineOpen((prev) => !prev)}
                onEstimateDateChange={(iso) => void patchJob({ estimate_date: iso })}
                formatDate={formatDate}
                formatRange={formatRange}
              />
            </CrmSectionCard>
          }
        />
      ) : null}

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
    </CrmPageShell>
  )
}
