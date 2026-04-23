'use client'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import { QuotesHomeCreatePanel } from './_home/QuotesHomeCreatePanel'
import { QuotesHomeDeleteDialog } from './_home/QuotesHomeDeleteDialog'
import { QuotesHomeHeader } from './_home/QuotesHomeHeader'
import { QuotesHomeJobList } from './_home/QuotesHomeJobList'
import { QuotesHomeSelectedJobPanel } from './_home/QuotesHomeSelectedJobPanel'
import { QuotesHomeSummaryCards } from './_home/QuotesHomeSummaryCards'
import { QuotesHomeVersionList } from './_home/QuotesHomeVersionList'
import { formatToday } from './_home/quoteHomePresentation'
import { S } from './_home/quoteHomeStyles'
import { useQuotesHomePage } from './_hooks/useQuotesHomePage'

type Props = {
  initialData?: QuoteHomeBootstrapReadModel | null
}

export default function QuotesHomePage({ initialData }: Props) {
  const controller = useQuotesHomePage(initialData)
  const { actions } = controller

  return (
    <div className="ace-v2-shell" style={S.main}>
      <div className="ace-v2-mobile-only" style={S.mobileScreen}>
        <div style={S.mobilePanel}>
          <div style={S.mobileBrandRow}>
            <div style={S.mobileBrandWrap}>
              <div style={S.mobileBrandMark}>A</div>
              <div style={{ ...S.brandName, fontSize: 16 }}>ACE CRM</div>
            </div>
            <div style={S.mobileAvatar}>AE</div>
          </div>

          <div>
            <div style={S.mobileDate}>{formatToday()}</div>
            <h1 style={S.mobileTitle}>Quote home</h1>
          </div>

          <div style={S.mobileStats}>
            {controller.mobileSummaryCards.map((card) => (
              <div key={`mobile-${card.label}`} style={S.mobileStatCard}>
                <div style={S.cardLabel}>{card.label}</div>
                <div style={{ ...S.statValue, fontSize: 18, marginBottom: 0 }}>{card.value}</div>
              </div>
            ))}
          </div>

          <QuotesHomeJobList
            vm={controller.jobList}
            renderDesktop={false}
            onJobQueryChange={actions.setJobQuery}
            onSelectJob={actions.setSelectedJobId}
          />
        </div>
      </div>

      <div className="ace-v2-desktop-only" style={{ ...S.content, ...S.desktopWrap }}>
        <QuotesHomeHeader
          vm={controller.header}
          onSearchFocusedChange={actions.setSearchFocused}
          onSearchQueryChange={actions.setSearchQuery}
          onSearchRetry={actions.retrySearch}
        />

        {controller.feedback.title ? (
          <div
            style={{
              ...S.card,
              marginBottom: 18,
              color: controller.feedback.tone === 'error' ? 'var(--v2-red)' : '#f9e2b7',
              borderColor:
                controller.feedback.tone === 'error'
                  ? 'rgba(248,113,113,0.28)'
                  : 'rgba(249,226,183,0.22)',
              background:
                controller.feedback.tone === 'error'
                  ? 'rgba(127,29,29,0.18)'
                  : 'rgba(120,83,26,0.18)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: controller.feedback.details.length > 0 ? 8 : 0 }}>
              {controller.feedback.title}
            </div>
            {controller.feedback.details.map((detail) => (
              <div key={detail} style={{ fontSize: 14, lineHeight: 1.6 }}>
                {detail}
              </div>
            ))}
          </div>
        ) : null}

        <QuotesHomeSummaryCards cards={controller.summaryCards} loading={controller.feedback.loading} />

        <div
          id="job-hub"
          className="v2-hub-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
            gap: 22,
          }}
        >
          <QuotesHomeJobList
            vm={controller.jobList}
            renderMobile={false}
            onJobQueryChange={actions.setJobQuery}
            onSelectJob={actions.setSelectedJobId}
          />

          <section style={{ display: 'grid', gap: 22, alignSelf: 'start' }}>
            <QuotesHomeSelectedJobPanel vm={controller.selectedJob} />

            <div
              className="v2-hub-detail-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
                gap: 22,
              }}
            >
              <QuotesHomeVersionList vm={controller.versionList} onRequestDelete={actions.requestDelete} />

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
            .v2-hub-grid {
              grid-template-columns: 1fr !important;
            }
            .v2-hub-detail-grid {
              grid-template-columns: 1fr !important;
            }
          }
          @media (max-width: 720px) {
            .v2-hub-job-stats {
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
    </div>
  )
}
