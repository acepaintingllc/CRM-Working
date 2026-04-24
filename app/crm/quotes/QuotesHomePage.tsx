'use client'
import type { ReactNode } from 'react'
import { Component } from 'react'
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

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

class QuotesHomeErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        role="alert"
        style={{
          border: '1px solid var(--crm-ui-danger-border)',
          borderRadius: 8,
          background: 'var(--crm-ui-danger-bg)',
          color: 'var(--crm-ui-danger-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: 16,
        }}
      >
        <p style={{ margin: 0, fontWeight: 800 }}>
          Something went wrong loading quotes
        </p>
        <CrmButton tone="secondary" onClick={() => window.location.reload()}>
          Reload
        </CrmButton>
      </div>
    )
  }
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

        <QuotesHomeErrorBoundary>
          <QuotesHomeContent initialData={initialData} />
        </QuotesHomeErrorBoundary>
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
