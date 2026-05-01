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
import { QuotesHomeSelectedJobResponsivePanel } from './_home/QuotesHomeSelectedJobPanel'
import { QuotesHomeSummaryCards } from './_home/QuotesHomeSummaryCards'
import { QuotesHomeVersionList } from './_home/QuotesHomeVersionList'
import { QUOTES_HOME_PAGE_COPY } from './_home/quoteHomePresentation'
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
          eyebrow={QUOTES_HOME_PAGE_COPY.header.eyebrow}
          title={QUOTES_HOME_PAGE_COPY.header.title}
          description={QUOTES_HOME_PAGE_COPY.header.description}
          badge={
            <CrmChip tone="accent">
              {QUOTES_HOME_PAGE_COPY.header.badge}
            </CrmChip>
          }
          actions={
            <>
              <CrmButton href="/crm/jobs/new" tone="secondary">
                {QUOTES_HOME_PAGE_COPY.header.createJobAction}
              </CrmButton>
              <a href="#job-hub" className={crmButtonClassName('primary')}>
                {QUOTES_HOME_PAGE_COPY.header.newQuoteAction}
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
  const pageVm = useQuotesHomePage(initialData)
  const { actions } = pageVm

  return (
    <>
      <QuotesHomeHeader
        vm={pageVm.header}
        onSearchFocusedChange={actions.setSearchFocused}
        onSearchQueryChange={actions.setSearchQuery}
        onSearchRetry={actions.retrySearch}
      />

      {pageVm.feedback ? (
        <div style={S.feedbackWrap}>
          <CrmNotice
            tone={pageVm.feedback.tone}
            title={pageVm.feedback.title}
          >
            <div style={S.feedbackDetails}>
              {pageVm.feedback.details.map((detail) => (
                <div key={detail}>{detail}</div>
              ))}
            </div>
          </CrmNotice>
        </div>
      ) : null}

      <QuotesHomeSummaryCards cards={pageVm.summaryCards} />

      <div
        id="job-hub"
        style={S.jobHubGrid}
      >
        <QuotesHomeJobList
          vm={pageVm.jobList}
          onJobQueryChange={actions.setJobQuery}
          onSelectJob={actions.setSelectedJobId}
          onLoadMore={actions.loadMore}
          onRetry={actions.retryJobs}
        />

        <section style={S.sectionStackLg}>
          <QuotesHomeSelectedJobResponsivePanel vm={pageVm.selectedJob} />

          <div
            style={S.jobHubDetailGrid}
          >
            <QuotesHomeVersionList
              vm={pageVm.versionList}
              onLoadMore={actions.loadMoreVersions}
              onRetry={actions.retryVersions}
              onRequestDelete={actions.requestDelete}
            />

            <QuotesHomeCreatePanel
              vm={pageVm.create}
              onCreate={actions.create}
              onVersionKindChange={actions.setVersionKind}
              onVersionNameChange={actions.setVersionName}
            />
          </div>
        </section>
      </div>

      <QuotesHomeDeleteDialog
        vm={pageVm.dialogs.delete}
        onCancel={actions.cancelDelete}
        onConfirm={() => void actions.confirmDelete()}
      />
    </>
  )
}
