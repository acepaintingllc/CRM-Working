'use client'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { crmButtonClassName } from '@/app/crm/_components/crmStyles'
import { QuotesHomeCreatePanel } from './_home/QuotesHomeCreatePanel'
import { QuotesHomeDeleteDialog } from './_home/QuotesHomeDeleteDialog'
import { QuotesHomeHeader } from './_home/QuotesHomeHeader'
import { QuotesHomeJobList } from './_home/QuotesHomeJobList'
import { QuotesHomeSelectedJobPanel } from './_home/QuotesHomeSelectedJobPanel'
import { QuotesHomeSummaryCards } from './_home/QuotesHomeSummaryCards'
import { QuotesHomeVersionList } from './_home/QuotesHomeVersionList'
import { S } from './_home/quoteHomeStyles'
import { useQuotesHomePage } from './_hooks/useQuotesHomePage'

type Props = {
  initialData?: QuoteHomeBootstrapReadModel | null
}

export default function QuotesHomePage({ initialData }: Props) {
  const controller = useQuotesHomePage(initialData)
  const { actions } = controller

  return (
    <CrmPageShell className="max-w-7xl">
      <div style={S.tokens}>
        <CrmPageHeader
          eyebrow="Quotes"
          title="Quote Home"
          description="Quote home follows the standard CRM page shell. Keep page framing on shared CRM primitives; keep only the job/version workflow panels route-local."
          badge={<CrmChip tone="accent">Shared CRM shell</CrmChip>}
          actions={
            <>
              <CrmButton href="/crm/jobs/new" tone="secondary">
                Create job
              </CrmButton>
              <a href="#job-hub" className={crmButtonClassName('primary')}>
                New quote
              </a>
            </>
          }
        />

        <QuotesHomeHeader
          vm={controller.header}
          onSearchFocusedChange={actions.setSearchFocused}
          onSearchQueryChange={actions.setSearchQuery}
          onSearchRetry={actions.retrySearch}
        />

        {controller.feedback.title ? (
          <div style={S.feedbackWrap}>
            <CrmNotice
              tone={controller.feedback.tone}
              title={controller.feedback.title}
            >
              <div style={S.feedbackDetails}>
                {controller.feedback.details.map((detail) => (
                  <div key={detail}>{detail}</div>
                ))}
              </div>
            </CrmNotice>
          </div>
        ) : null}

        <QuotesHomeSummaryCards
          cards={
            controller.feedback.loading
              ? controller.mobileSummaryCards
              : controller.summaryCards
          }
          loading={controller.feedback.loading}
        />

        <div
          id="job-hub"
          className="quotes-home-job-hub-grid"
          style={S.jobHubGrid}
        >
          <QuotesHomeJobList
            vm={controller.jobList}
            renderMobile={false}
            onJobQueryChange={actions.setJobQuery}
            onSelectJob={actions.setSelectedJobId}
          />

          <section style={S.sectionStackLg}>
            <QuotesHomeSelectedJobPanel vm={controller.selectedJob} />

            <div
              className="quotes-home-job-hub-detail-grid"
              style={S.jobHubDetailGrid}
            >
              <QuotesHomeVersionList
                vm={controller.versionList}
                onRequestDelete={actions.requestDelete}
              />

              <QuotesHomeCreatePanel
                vm={controller.create}
                onCreate={() => void actions.create()}
                onVersionKindChange={actions.setVersionKind}
                onVersionNameChange={actions.setVersionName}
              />
            </div>
          </section>
        </div>

        <style jsx>{`
          @media (max-width: 980px) {
            .quotes-home-job-hub-grid {
              grid-template-columns: 1fr !important;
            }
            .quotes-home-job-hub-detail-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>

      <QuotesHomeDeleteDialog
        vm={controller.dialogs.delete}
        onCancel={actions.cancelDelete}
        onConfirm={() => void actions.confirmDelete()}
      />
    </CrmPageShell>
  )
}
