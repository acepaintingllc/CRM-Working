'use client'

import Link from 'next/link'
import { CrmEntityFormPage } from '@/app/crm/_components/CrmEntityFormPage'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { JobCreateForm } from '@/app/crm/jobs/_components/JobCreateForm'
import { useNewJobPage } from '@/app/crm/jobs/_hooks/useNewJobPage'

export default function NewJobPage() {
  const controller = useNewJobPage()

  return (
    <CrmPageShell className="max-w-[900px]">
      <CrmPageHeader
        eyebrow="Pipeline workflow"
        emoji="🛠️"
        title="New job"
        description="Create a job with the shared CRM form flow, then continue from the detail page."
        backHref="/crm/jobs"
        backLabel="Back to jobs"
      />

      <CrmResourceState
        loading={controller.customerResource.loading}
        error={controller.customerResource.error}
        hasData={controller.hasCustomerChoices}
        loadingTitle="Loading customers"
        loadingDescription="Loading customers..."
        errorTitle="Customers unavailable"
        emptyTitle="No customers yet"
        emptyDescription="Add a customer before creating a job."
        onRetry={() => void controller.customerResource.refresh()}
      >
        <CrmEntityFormPage
          title="Job setup"
          description="Shared CRM fields and orchestration now define the create-job flow."
          error={controller.error}
          notice={controller.notice}
          validationError={controller.validationError}
          saveLabel="Create job"
          savingLabel="Saving..."
          saving={controller.saving}
          canSave={controller.canSave}
          actions={null}
        >
          <JobCreateForm
            value={controller.value}
            customers={controller.filteredCustomers}
            saving={controller.saving}
            composeLoading={controller.composeLoading}
            sendingStage={controller.sendingStage}
            onChange={controller.setValue}
            onSubmit={() => void controller.save()}
            onOpenComposer={() => void controller.openComposer('estimate_scheduled')}
            onSubmitAndSendEstimateScheduled={() =>
              void controller.save({ sendEstimateScheduled: true })
            }
          />
          {controller.createdJobId && controller.error ? (
            <div className="mt-4 text-sm text-[color:var(--crm-ui-muted)]">
              Job created.{' '}
              <Link
                href={`/crm/jobs/${controller.createdJobId}`}
                className="font-bold text-[color:var(--crm-ui-text)]"
              >
                Open job
              </Link>
            </div>
          ) : null}
        </CrmEntityFormPage>
      </CrmResourceState>
    </CrmPageShell>
  )
}
