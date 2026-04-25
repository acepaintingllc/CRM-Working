'use client'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/quoteHomeTypes'
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
import { QuotesHomeRecoveryBoundary } from './_home/QuotesHomeRecoveryBoundary'
import { QuotesHomeSelectedJobPanel } from './_home/QuotesHomeSelectedJobPanel'
import { QuotesHomeSummaryCards } from './_home/QuotesHomeSummaryCards'
import { QuotesHomeVersionList } from './_home/QuotesHomeVersionList'
import { S } from './_home/quoteHomeStyles'
import { useQuotesHomePage } from './_hooks/useQuotesHomePage'

type Props = {
  initialData?: QuoteHomeBootstrapReadModel | null
}

export default function QuotesHomePage({ initialData }: Props) {
  return (
    <CrmPageShell className="max-w-7xl">
      <div style={S.tokens}>
        <CrmPageHeader
          eyebrow="Quotes"
          title="Quote Home"
          description="Search jobs, review quote versions, and start a new quote from one place."
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

        <QuotesHomeRecoveryBoundary>
          <QuotesHomeContent initialData={initialData} />
        </QuotesHomeRecoveryBoundary>
      </div>
    </CrmPageShell>
  )
}

function QuotesHomeContent({ initialData }: Props) {
  const controller = useQuotesHomePage(initialData)
  const { actions } = controller

  return (
    <>
      <QuotesHomeHeader
        vm={controller.header}
        onSearchFocusedChange={actions.setSearchFocused}
        onSearchQueryChange={actions.setSearchQuery}
        onSearchRetry={actions.retrySearch}
      />

      {controller.feedback ? (
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

      <QuotesHomeSummaryCards cards={controller.summaryCards} />

      <div
        id="job-hub"
        style={S.jobHubGrid}
      >
        <QuotesHomeJobList
          vm={controller.jobList}
          onJobQueryChange={actions.setJobQuery}
          onSelectJob={actions.setSelectedJobId}
          onLoadMore={actions.loadMore}
          onRetry={actions.retryJobs}
        />

        <section style={S.sectionStackLg}>
          <QuotesHomeSelectedJobPanel vm={controller.selectedJob} />

          <div
            style={S.jobHubDetailGrid}
          >
            <QuotesHomeVersionList
              vm={controller.versionList}
              onLoadMore={actions.loadMoreVersions}
              onRetry={actions.retryVersions}
              onRequestDelete={actions.requestDelete}
            />

            <QuotesHomeCreatePanel
              vm={controller.create}
              onCreate={actions.create}
              onVersionKindChange={actions.setVersionKind}
              onVersionNameChange={actions.setVersionName}
            />
          </div>
        </section>
      </div>

      <QuotesHomeDeleteDialog
        vm={controller.dialogs.delete}
        onCancel={actions.cancelDelete}
        onConfirm={() => void actions.confirmDelete()}
      />
    </>
  )
}
