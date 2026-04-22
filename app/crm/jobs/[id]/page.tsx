'use client'

import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useJobDetailPage } from '@/app/crm/jobs/_hooks/useJobDetailPage'
import JobCompletionCloseoutModal from '@/app/crm/jobs/_components/JobCompletionCloseoutModal'
import StageEmailModal from '@/app/crm/jobs/_components/StageEmailModal'
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
  const controller = useJobDetailPage()

  const detailActions = controller.job ? getJobWorkflowActions('detail', controller.job) : []

  const actionTone = (action: JobWorkflowResolvedAction) =>
    action.tone === 'accent' ? 'primary' : action.tone === 'danger' ? 'danger' : 'secondary'

  return (
    <CrmPageShell className="max-w-6xl">
      <CrmPageHeader
        eyebrow="Pipeline workflow"
        emoji="🧾"
        title={controller.job?.title ?? 'Job details'}
        description="Shared CRM job detail page with workflow actions, schedule context, and closeout data."
        backHref="/crm/jobs"
        backLabel="Back to jobs"
      />

      <CrmResourceState
        loading={controller.resource.loading}
        error={controller.resource.error}
        hasData={Boolean(controller.job)}
        loadingTitle="Loading job"
        loadingDescription="Loading job..."
        errorTitle="Job unavailable"
        emptyTitle="Job not found"
        emptyDescription="This job could not be found."
        onRetry={() => void controller.resource.refresh()}
      >
        {controller.notice ? <CrmNotice tone="success">{controller.notice}</CrmNotice> : null}

        {controller.job ? (
          <>
            <JobDetailHeader
              title={controller.job.title}
              status={controller.job.status}
              statusOptions={JOB_STATUS_OPTIONS}
              deleting={controller.deleting}
              onBack={() => controller.router.back()}
              onDelete={() => void controller.deleteJob()}
              onStatusChange={(status) => void controller.handleStatusChange(status)}
              formatStatus={controller.formatStatus}
            />

            <CrmDetailLayout
              main={
                <>
                  <CrmSectionCard title="Details">
                    <JobDetailsPanel
                      job={controller.job}
                      estimateFile={controller.estimateFile}
                      estimateFileError={controller.estimateFileError}
                      onCopy={(label, value) => void controller.copy(label, value)}
                    />
                  </CrmSectionCard>
                  <CrmSectionCard title="Closeout">
                    <JobCloseoutPanel
                      job={controller.job}
                      paintLogs={controller.paintLogs}
                      afterPhotos={controller.afterPhotos}
                      sitePhotos={controller.sitePhotos}
                      detailActions={detailActions}
                      formatDate={controller.formatDate}
                    />
                  </CrmSectionCard>
                  <CrmSectionCard title="Actions" variant="compact">
                    <JobActionRail
                      actions={detailActions}
                      getActionTone={actionTone}
                      onAction={(action) => void controller.runWorkflowAction(action)}
                    />
                  </CrmSectionCard>
                </>
              }
              side={
                <CrmSectionCard title="Timeline" variant="rail">
                  <JobTimeline
                    job={controller.job}
                    open={controller.timelineOpen}
                    onToggle={() => controller.setTimelineOpen((prev) => !prev)}
                    onEstimateDateChange={(iso) => void controller.patchJob({ estimate_date: iso })}
                    formatDate={controller.formatDate}
                    formatRange={controller.formatRange}
                  />
                </CrmSectionCard>
              }
            />
          </>
        ) : null}
      </CrmResourceState>

      <StageEmailModal
        jobId={typeof controller.id === 'string' ? controller.id : null}
        stage={controller.emailStage}
        open={controller.emailStage != null}
        onClose={controller.closeStageEmail}
        onSent={controller.handleStageEmailSent}
      />
      <JobCompletionCloseoutModal
        jobId={typeof controller.id === 'string' ? controller.id : null}
        open={controller.closeoutOpen}
        onClose={controller.closeCloseout}
        onSaved={(result) => void controller.handleCloseoutSaved(result)}
      />
    </CrmPageShell>
  )
}
