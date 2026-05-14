'use client'

import { useRef } from 'react'
import { Camera, Upload } from 'lucide-react'

import { CrmButton } from '@/app/crm/_components/CrmButton'
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
import { JOB_STATUS_OPTIONS } from '@/lib/jobs/types'

export default function JobDetailPage() {
  const controller = useJobDetailPage()
  const manualQuoteInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <CrmPageShell className="crm-job-detail-shell max-w-6xl">
      <CrmPageHeader
        eyebrow="Pipeline workflow"
        emoji="🧾"
        title={controller.job?.title ?? 'Job details'}
        description="Full job overview and schedule."
        backHref="/crm/jobs"
        backLabel="Back to jobs"
        className="crm-job-detail-page-header"
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
                  <JobCloseoutPanel vm={controller.closeoutReferenceVm} />
                  <CrmSectionCard title="Actions" variant="compact">
                    <CrmButton
                      href={`/crm/job-photos?job=${controller.job.id}`}
                      tone="secondary"
                      className="min-h-9 px-3 text-xs"
                    >
                      <Camera size={14} aria-hidden="true" />
                      <span>Job Photos</span>
                    </CrmButton>
                    <input
                      ref={manualQuoteInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      disabled={controller.manualQuoteUploading}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null
                        event.currentTarget.value = ''
                        void controller.uploadManualQuote(file)
                      }}
                    />
                    <CrmButton
                      tone="secondary"
                      className="min-h-9 px-3 text-xs"
                      disabled={controller.manualQuoteUploading}
                      onClick={() => manualQuoteInputRef.current?.click()}
                    >
                      <Upload size={14} aria-hidden="true" />
                      <span>{controller.manualQuoteUploading ? 'Uploading PDF...' : 'Upload Quote PDF'}</span>
                    </CrmButton>
                    {controller.photosFolderUrl ? (
                      <CrmButton href={controller.photosFolderUrl} target="_blank" rel="noreferrer">
                        Open Photos
                      </CrmButton>
                    ) : null}
                    <JobActionRail
                      actions={controller.workflowActions}
                      onAction={(action) => void controller.runWorkflowAction(action)}
                    />
                  </CrmSectionCard>
                </>
              }
              side={
                <CrmSectionCard title="Timeline" variant="rail">
                  <JobTimeline
                    items={controller.timelineItems}
                    open={controller.timelineOpen}
                    onToggle={() => controller.setTimelineOpen((prev) => !prev)}
                    onEstimateDateChange={(iso) => void controller.updateEstimateDate(iso)}
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
