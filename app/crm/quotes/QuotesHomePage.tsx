'use client'
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

export default function QuotesHomePage() {
  const controller = useQuotesHomePage()
  const {
    actions,
    createVm,
    deleteDialogVm,
    feedbackVm,
    headerVm,
    jobListVm,
    mobileVm,
    selectedJobVm,
    summaryCards,
    versionListVm,
  } = controller

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
            {mobileVm.summaryCards.map((card) => (
              <div key={`mobile-${card.label}`} style={S.mobileStatCard}>
                <div style={S.cardLabel}>{card.label}</div>
                <div style={{ ...S.statValue, fontSize: 18, marginBottom: 0 }}>{card.value}</div>
              </div>
            ))}
          </div>

          <QuotesHomeJobList
            vm={jobListVm}
            renderDesktop={false}
            onJobQueryChange={actions.setJobQuery}
            onSelectJob={actions.setSelectedJobId}
          />
        </div>
      </div>

      <div className="ace-v2-desktop-only" style={{ ...S.content, ...S.desktopWrap }}>
        <QuotesHomeHeader
          vm={headerVm}
          onSearchFocusedChange={actions.setSearchFocused}
          onSearchQueryChange={actions.setSearchQuery}
        />

        {feedbackVm.error ? (
          <div
            style={{
              ...S.card,
              color: 'var(--v2-red)',
              marginBottom: 18,
              borderColor: 'rgba(248,113,113,0.28)',
              background: 'rgba(127,29,29,0.18)',
            }}
          >
            {feedbackVm.error}
          </div>
        ) : null}

        <QuotesHomeSummaryCards cards={summaryCards} loading={feedbackVm.loading} />

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
            vm={jobListVm}
            renderMobile={false}
            onJobQueryChange={actions.setJobQuery}
            onSelectJob={actions.setSelectedJobId}
          />

          <section style={{ display: 'grid', gap: 22, alignSelf: 'start' }}>
            <QuotesHomeSelectedJobPanel vm={selectedJobVm} />

            <div
              className="v2-hub-detail-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
                gap: 22,
              }}
            >
              <QuotesHomeVersionList vm={versionListVm} onRequestDelete={actions.requestDeleteVersion} />

              <QuotesHomeCreatePanel
                vm={createVm}
                onCreate={() => void actions.createVersion()}
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
        vm={deleteDialogVm}
        onCancel={actions.cancelDelete}
        onConfirm={() => void actions.confirmDeleteVersion()}
      />
    </div>
  )
}
