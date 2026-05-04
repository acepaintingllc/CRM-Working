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
import { useJobActualsPage } from './_hooks/useJobActualsPage'
import { ActualsInputSection } from './_components/ActualsInputSection'
import { EstimateComparisonSection } from './_components/EstimateComparisonSection'

export function JobActualsPageContent() {
  const controller = useJobActualsPage()

  return (
    <CrmPageShell className="max-w-5xl">
      <CrmPageHeader
        eyebrow="Job closeout"
        title="Job actuals"
        description="Record job-level labor, paint, and cost actuals against the accepted estimate snapshot."
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
        loadingTitle="Loading actuals"
        loadingDescription="Loading accepted estimate and job actuals..."
        errorTitle="Job actuals unavailable"
        emptyTitle="Job not found"
        emptyDescription="This job could not be found."
        onRetry={() => void controller.load()}
      >
        {controller.error ? <CrmNotice tone="error">{controller.error}</CrmNotice> : null}
        {controller.notice ? <CrmNotice tone="success">{controller.notice}</CrmNotice> : null}

        {!controller.vm ? (
          <CrmEmptyState
            title="No accepted estimate snapshot"
            description="This job has an accepted quote, but the immutable estimate snapshot is missing. Retry snapshot creation before entering actuals."
            action={
              controller.job?.accepted_quote ? (
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <ActualsInputSection
              form={controller.form}
              fields={controller.vm.inputFields}
              actualsStatus={controller.actuals?.status ?? null}
              saving={controller.saving}
              submitting={controller.submitting}
              isReadOnly={controller.isReadOnly}
              validation={controller.validation}
              setField={controller.setField}
              saveDraft={controller.saveDraft}
              submit={controller.submit}
            />
            <EstimateComparisonSection vm={controller.vm} />
          </div>
        )}
      </CrmResourceState>
      <CrmConfirmDialog
        isOpen={controller.discardVm.isOpen}
        labelledBy="job-actuals-discard-title"
        title="Discard unsaved changes?"
        description="You have unsaved actuals that are not yet saved."
        closeLabel="Close discard confirmation"
        warning="Leaving this page will discard unsaved actuals."
        info="Choose Discard to return to the job, or Cancel to keep editing actuals."
        confirmLabel="Discard and return"
        onConfirm={() => void controller.confirmBackToJob()}
        onCancel={controller.cancelDiscard}
      />
    </CrmPageShell>
  )
}
