'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { QuoteAdminPageBanner } from '@/app/crm/quotes/_components/QuoteAdminPageBanner'
import { useQuoteCreatePage } from '@/app/crm/quotes/_hooks/useQuoteCreatePage'
import { QuoteCreateFormSection } from './QuoteCreateFormSection'
import { QuoteCreateJobSection } from './QuoteCreateJobSection'
import { QuoteCreateVersionsSection } from './QuoteCreateVersionsSection'

export function QuoteCreatePageContent() {
  const controller = useQuoteCreatePage()
  const handleRetry =
    controller.feedback.loadError && controller.feedback.shouldLoadJobData
      ? () => void controller.actions.retry()
      : null

  return (
    <div className="grid gap-4">
      <QuoteAdminPageBanner banner={controller.feedback.pageBanner} />

      <CrmDetailLayout
        main={
          <CrmResourceState
            loading={controller.feedback.loading && controller.feedback.shouldLoadJobData}
            error={null}
            hasData={false}
            loadingTitle="Loading quote creation data"
            loadingDescription="Loading the selected job and existing quote versions..."
          >
            {controller.feedback.shouldLoadJobData ? (
              controller.feedback.loadError ? (
                <CrmSectionCard title="Quote creation data unavailable">
                  <div className="grid gap-4">
                    <p className="text-sm text-[color:var(--crm-ui-muted)]">
                      Existing quote data could not be loaded for this job. You can retry without losing
                      the current version draft.
                    </p>
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
                    title={controller.job.title}
                    customerLine={controller.job.customerLine}
                    jobHref={controller.job.jobHref}
                  />
                  <QuoteCreateVersionsSection items={controller.versions.items} />
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
            versionName={controller.create.versionName}
            versionKind={controller.create.versionKind}
            creating={controller.create.creating}
            canCreate={controller.create.canCreate}
            onCreate={() => void controller.actions.create()}
            onVersionKindChange={controller.actions.setVersionKind}
            onVersionNameChange={controller.actions.setVersionName}
          />
        }
      />
    </div>
  )
}
