'use client'

import { ArrowLeft } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmConfirmDialog } from '@/app/crm/_components/CrmConfirmDialog'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { useJobReviewPage } from './_hooks/useJobReviewPage'
import { ReviewClassificationSection } from './_components/ReviewClassificationSection'
import { ReviewSummarySection } from './_components/ReviewSummarySection'
import { VarianceBreakdownSection } from './_components/VarianceBreakdownSection'

export function JobReviewPageContent() {
  const controller = useJobReviewPage()

  return (
    <CrmPageShell className="max-w-6xl">
      <CrmPageHeader
        eyebrow="Job closeout"
        title="Estimate review"
        description="Compare the accepted estimate snapshot with submitted actuals and classify variance quality."
        backAction={
          <CrmButton type="button" tone="secondary" onClick={() => void controller.backToJob()}>
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Back to job</span>
            </span>
          </CrmButton>
        }
        meta={
          controller.vm ? (
            <CrmChip tone={controller.dirty ? 'warning' : 'success'}>
              {controller.dirty ? 'Unsaved changes' : 'Saved'}
            </CrmChip>
          ) : null
        }
      />

      <CrmResourceState
        loading={controller.loading}
        error={controller.error}
        hasData={Boolean(controller.job)}
        loadingTitle="Loading review"
        loadingDescription="Loading submitted actuals and computed review metrics..."
        errorTitle="Job review unavailable"
        emptyTitle="Job not found"
        emptyDescription="This job could not be found."
        onRetry={() => void controller.load()}
      >
        {controller.notice ? <CrmNotice tone="success">{controller.notice}</CrmNotice> : null}

        {!controller.vm ? (
          <CrmEmptyState
            title="Review unavailable"
            description="Job review needs an accepted estimate snapshot and submitted actuals. If the accepted quote is missing its snapshot, retry snapshot creation first."
            action={
              controller.job?.accepted_quote && !controller.job.accepted_quote.estimate_snapshot_id ? (
                <CrmButton
                  tone="primary"
                  disabled={controller.repairingSnapshot}
                  onClick={() => void controller.repairSnapshot()}
                >
                  {controller.repairingSnapshot ? 'Repairing...' : 'Retry snapshot repair'}
                </CrmButton>
              ) : (
                <CrmButton href={controller.backHref} tone="secondary">
                  Back to job
                </CrmButton>
              )
            }
          />
        ) : (
          <div className="grid gap-4">
            <ReviewSummarySection
              vm={controller.vm}
              saving={controller.saving}
              reviewing={controller.reviewing}
              locking={controller.locking}
              isReadOnly={controller.isReadOnly}
              saveDraft={controller.saveDraft}
              markReviewed={controller.markReviewed}
              lock={controller.lock}
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <VarianceBreakdownSection metrics={controller.vm.metrics} />
              <ReviewClassificationSection
                form={controller.form}
                vm={controller.vm}
                isReadOnly={controller.isReadOnly}
                setField={controller.setField}
              />
            </div>
          </div>
        )}
      </CrmResourceState>
      <CrmConfirmDialog
        isOpen={controller.discardVm.isOpen}
        labelledBy="job-review-discard-title"
        title="Discard unsaved changes?"
        description="You have unsaved review classifications that are not yet saved."
        closeLabel="Close discard confirmation"
        warning="Leaving this page will discard unsaved review classifications."
        info="Choose Discard to return to the job, or Cancel to keep reviewing."
        confirmLabel="Discard and return"
        onConfirm={() => void controller.confirmBackToJob()}
        onCancel={controller.cancelDiscard}
      />
    </CrmPageShell>
  )
}
