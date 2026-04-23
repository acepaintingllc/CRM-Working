'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useQuoteCreatePage } from '@/app/crm/quotes/_hooks/useQuoteCreatePage'
import { QuoteCreateFormSection } from './QuoteCreateFormSection'
import { QuoteCreateJobSection } from './QuoteCreateJobSection'
import { QuoteCreateVersionsSection } from './QuoteCreateVersionsSection'

export function QuoteCreatePageContent() {
  const controller = useQuoteCreatePage()
  const handleRetry =
    controller.feedbackVm.loadError && controller.feedbackVm.shouldLoadJobData
      ? () => void controller.actions.retry()
      : null

  return (
    <div className="grid gap-4">
      {controller.feedbackVm.error ? (
        <CrmNotice tone="error">{controller.feedbackVm.error}</CrmNotice>
      ) : null}

      <CrmDetailLayout
        main={
          <CrmResourceState
            loading={controller.feedbackVm.loading && controller.feedbackVm.shouldLoadJobData}
            error={null}
            hasData={false}
            loadingTitle="Loading quote creation data"
            loadingDescription="Loading the selected job and existing quote versions..."
          >
            {controller.feedbackVm.shouldLoadJobData ? (
              controller.feedbackVm.loadError ? (
                <CrmSectionCard title="Quote creation data unavailable">
                  <div className="grid gap-4">
                    <p className="text-sm text-[color:var(--crm-ui-muted)]">
                      Existing quote data could not be loaded for this job. You can retry without losing
                      the current version draft.
                    </p>
                    {handleRetry ? <CrmNotice tone="error" compact>{controller.feedbackVm.loadError}</CrmNotice> : null}
                    {handleRetry ? (
                      <div>
                        <CrmButton type="button" onClick={handleRetry}>
                          Retry
                        </CrmButton>
                      </div>
                    ) : null}
                  </div>
                </CrmSectionCard>
              ) : (
                <div className="grid gap-4">
                  <QuoteCreateJobSection
                    title={controller.selectedJobVm.title}
                    customerLine={controller.selectedJobVm.customerLine}
                    jobHref={controller.selectedJobVm.jobHref}
                  />
                  <QuoteCreateVersionsSection items={controller.versionsVm.items} />
                </div>
              )
            ) : (
              <CrmSectionCard
                title="Unknown job"
                description="Open this page from quote home or pass a job query parameter to create a version."
              >
                <div className="text-sm text-[color:var(--crm-ui-muted)]">
                  Quote creation stays disabled until a valid, eligible job is selected.
                </div>
              </CrmSectionCard>
            )}
          </CrmResourceState>
        }
        side={
          <QuoteCreateFormSection
            versionName={controller.createVm.versionName}
            versionKind={controller.createVm.versionKind}
            creating={controller.createVm.creating}
            canCreate={controller.createVm.canCreate}
            onCreate={() => void controller.actions.createVersion()}
            onVersionKindChange={controller.actions.setVersionKind}
            onVersionNameChange={controller.actions.setVersionName}
          />
        }
      />
    </div>
  )
}
