'use client'

import { BarChart3, Check, RefreshCw, Sparkles, X } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmConfirmDialog } from '@/app/crm/_components/CrmConfirmDialog'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useInsightsTrendsPage } from './_hooks/useInsightsTrendsPage'

function iconLabel(label: string) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <RefreshCw size={16} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

export function InsightsPageContent() {
  const {
    loading,
    error,
    hasData,
    filters,
    filterInputs,
    setFilter,
    resetFilters,
    applyRecommendation,
    cancelApplyRecommendation,
    confirmApplyRecommendation,
    dismissRecommendation,
    generateRecommendations,
    feedback,
    recommendationActionState,
    refresh,
    vm,
  } = useInsightsTrendsPage()
  const confirmingApplyCard =
    vm?.recommendations.find(
      (card) => card.id === recommendationActionState.confirmingApplyId
    ) ?? null
  const confirmingApply =
    recommendationActionState.pendingId === recommendationActionState.confirmingApplyId &&
    recommendationActionState.pendingAction === 'apply'

  return (
    <CrmPageShell className="max-w-[1600px]">
      <CrmPageHeader
        eyebrow="Portfolio insights"
        title="Trends and insights"
        description="Review locked job-review trends across the portfolio and spot repeated estimating misses."
        badge={<CrmChip tone="accent">Locked reviews only</CrmChip>}
        actions={
          <CrmButton type="button" onClick={() => void refresh()} tone="secondary">
            {iconLabel(loading ? 'Refreshing' : 'Refresh')}
          </CrmButton>
        }
      />

      {error && hasData ? <CrmNotice tone="error">{error}</CrmNotice> : null}
      {feedback.actionError ? (
        <CrmNotice tone="error">{feedback.actionError}</CrmNotice>
      ) : null}
      {feedback.actionNotice ? (
        <CrmNotice tone="success">{feedback.actionNotice}</CrmNotice>
      ) : null}

      <CrmConfirmDialog
        isOpen={Boolean(confirmingApplyCard)}
        labelledBy="insights-apply-recommendation-title"
        title="Apply recommendation?"
        description={
          confirmingApplyCard
            ? `Apply ${confirmingApplyCard.title} to estimator settings.`
            : 'Apply this recommendation to estimator settings.'
        }
        closeLabel="Close apply confirmation"
        warning="This activates a new estimator setting set immediately. New estimates will use the suggested setting after confirmation."
        info={
          confirmingApplyCard
            ? `Target: ${confirmingApplyCard.targetSettingKey}. Current value: ${confirmingApplyCard.currentValue}. Suggested value: ${confirmingApplyCard.suggestedValue}.`
            : null
        }
        cancelLabel="Keep open"
        confirmLabel="Activate setting set"
        confirmingLabel="Activating"
        confirming={confirmingApply}
        confirmDisabled={confirmingApply}
        cancelDisabled={confirmingApply}
        confirmTone="primary"
        onCancel={cancelApplyRecommendation}
        onConfirm={() => void confirmApplyRecommendation()}
      />

      <CrmSectionCard
        title="Filters"
        description="Filter the trend set by locked-review date and snapshot attributes."
        actions={
          <CrmButton type="button" onClick={resetFilters} tone="secondary">
            Reset filters
          </CrmButton>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <CrmField label="Locked from">
            <input
              type="date"
              className="ace-crm-input text-sm"
              value={filters.from ?? ''}
              onChange={(event) => setFilter('from', event.target.value)}
            />
          </CrmField>
          <CrmField label="Locked to">
            <input
              type="date"
              className="ace-crm-input text-sm"
              value={filters.to ?? ''}
              onChange={(event) => setFilter('to', event.target.value)}
            />
          </CrmField>
          <CrmField label="Job type">
            <input
              type="text"
              className="ace-crm-input text-sm"
              value={filters.jobType ?? ''}
              onChange={(event) => setFilter('jobType', event.target.value)}
              placeholder="interior"
            />
          </CrmField>
          <CrmField label="Occupancy">
            <select
              className="ace-crm-input text-sm"
              value={filters.occupancy ?? ''}
              onChange={(event) => setFilter('occupancy', event.target.value)}
            >
              <option value="">Any</option>
              <option value="occupied">Occupied</option>
              <option value="vacant">Vacant</option>
            </select>
          </CrmField>
          <CrmField label="Condition tags" help="Comma-separated snapshot tags.">
            <input
              type="text"
              className="ace-crm-input text-sm"
              value={filterInputs.conditionTags}
              onChange={(event) => setFilter('conditionTags', event.target.value)}
              placeholder="peeling, trim-heavy"
            />
          </CrmField>
          <CrmField
            label="Max absolute variance"
            help="Exclude metrics above this absolute variance."
          >
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              className="ace-crm-input text-sm"
              value={filterInputs.maxAbsoluteVariance}
              onChange={(event) =>
                setFilter('maxAbsoluteVariance', event.target.value)
              }
              placeholder="12.5"
            />
          </CrmField>
          <CrmField
            label="Max absolute total impact"
            help="Exclude metrics above this absolute total impact."
          >
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              className="ace-crm-input text-sm"
              value={filterInputs.maxAbsoluteTotalImpact}
              onChange={(event) =>
                setFilter('maxAbsoluteTotalImpact', event.target.value)
              }
              placeholder="250"
            />
          </CrmField>
        </div>
      </CrmSectionCard>

      <CrmResourceState
        loading={loading}
        error={error}
        hasData={hasData}
        loadingTitle="Loading trend insights"
        loadingDescription="Loading locked-review trend data."
        errorTitle="Unable to load trend insights"
        onRetry={refresh}
      >
        {vm ? (
          <div className="grid gap-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {vm.kpis.map((kpi) => (
                <CrmSectionCard key={kpi.id} variant="compact">
                  <div className="grid gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="ace-crm-mono text-[11px] font-bold text-[color:var(--crm-ui-muted)]">
                        {kpi.label}
                      </div>
                      <CrmChip tone={kpi.tone}>{kpi.badge}</CrmChip>
                    </div>
                    <div className="text-2xl font-black text-[color:var(--crm-ui-text)]">
                      {kpi.value}
                    </div>
                    <p className="text-sm leading-6 text-[color:var(--crm-ui-muted)]">
                      {kpi.detail}
                    </p>
                  </div>
                </CrmSectionCard>
              ))}
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
              <CrmSectionCard
                title="Variance breakdown"
                description="Average variance and impact by trend metric."
                badge={<CrmChip>{vm.jobsAnalyzedLabel}</CrmChip>}
              >
                {vm.hasMetrics ? (
                  <div className="grid gap-2">
                    {vm.varianceRows.map((row) => (
                      <div
                        key={row.id}
                        className="grid gap-3 rounded-xl border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface-muted)] px-4 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                      >
                        <div>
                          <div className="font-extrabold text-[color:var(--crm-ui-text)]">
                            {row.label}
                          </div>
                          <div className="text-xs text-[color:var(--crm-ui-muted)]">
                            {row.description}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-[color:var(--crm-ui-text)]">
                          {row.averageVariance}
                        </div>
                        <div className="text-sm font-bold text-[color:var(--crm-ui-text)]">
                          {row.averageImpact}
                        </div>
                        <CrmChip tone={row.tone}>{row.countLabel}</CrmChip>
                      </div>
                    ))}
                  </div>
                ) : (
                  <CrmEmptyState
                    title="No variance metrics yet"
                    description="Locked, valid reviews will populate the variance breakdown after the selected filters match data."
                  />
                )}
              </CrmSectionCard>

              <CrmSectionCard
                title="Observed patterns"
                description="Repeated metric patterns ranked by portfolio impact."
              >
                {vm.patterns.length > 0 ? (
                  <div className="grid gap-2">
                    {vm.patterns.map((pattern) => (
                      <div
                        key={pattern.id}
                        className="rounded-xl border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface-muted)] px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-extrabold text-[color:var(--crm-ui-text)]">
                            {pattern.label}
                          </div>
                          <CrmChip tone={pattern.tone}>{pattern.countLabel}</CrmChip>
                        </div>
                        <div className="mt-2 grid gap-1 text-sm text-[color:var(--crm-ui-muted)]">
                          <div>Average variance: {pattern.averageVariance}</div>
                          <div>Average impact: {pattern.averageImpact}</div>
                          <div>Total impact: {pattern.totalImpact}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <CrmEmptyState
                    title="No observed patterns"
                    description="Patterns appear when the selected locked reviews include repeated variance metrics."
                  />
                )}
              </CrmSectionCard>
            </div>

            <CrmSectionCard
              title="Recommendation cards"
              description="Open setting recommendations generated from locked review trends."
              badge={<CrmChip tone="accent">{vm.recommendationCountLabel}</CrmChip>}
              actions={
                <CrmButton
                  type="button"
                  onClick={() => void generateRecommendations()}
                  tone="primary"
                  disabled={recommendationActionState.generating}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles size={15} aria-hidden="true" />
                    <span>
                      {recommendationActionState.generating
                        ? 'Generating'
                        : 'Generate recommendations'}
                    </span>
                  </span>
                </CrmButton>
              }
            >
              {vm.recommendations.length > 0 ? (
                <div className="grid gap-3 xl:grid-cols-3">
                  {vm.recommendations.map((card) => {
                    const pendingAction =
                      recommendationActionState.pendingId === card.id
                        ? recommendationActionState.pendingAction
                        : null
                    const isConfirming =
                      recommendationActionState.confirmingApplyId === card.id
                    const isPending = Boolean(pendingAction) || isConfirming

                    return (
                      <div
                        key={card.id}
                        className="grid gap-4 rounded-lg border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface-muted)] px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-extrabold text-[color:var(--crm-ui-text)]">
                              <BarChart3 size={16} aria-hidden="true" />
                              <span>{card.title}</span>
                            </div>
                            <div className="mt-1 break-words text-xs text-[color:var(--crm-ui-muted)]">
                              {card.targetSettingKey}
                            </div>
                          </div>
                          <CrmChip tone={card.confidenceTone}>
                            {card.confidenceLabel}
                          </CrmChip>
                        </div>

                        <div className="grid gap-2 text-sm">
                          <div>
                            <div className="ace-crm-mono text-[10px] font-bold text-[color:var(--crm-ui-muted)]">
                              Current value
                            </div>
                            <div className="mt-1 break-words font-bold text-[color:var(--crm-ui-text)]">
                              {card.currentValue}
                            </div>
                          </div>
                          <div>
                            <div className="ace-crm-mono text-[10px] font-bold text-[color:var(--crm-ui-muted)]">
                              Suggested value
                            </div>
                            <div className="mt-1 break-words font-bold text-[color:var(--crm-ui-text)]">
                              {card.suggestedValue}
                            </div>
                          </div>
                        </div>

                        <p className="text-sm leading-6 text-[color:var(--crm-ui-muted)]">
                          {card.reason}
                        </p>

                        <div className="grid gap-1 text-xs text-[color:var(--crm-ui-muted)]">
                          <div className="font-bold text-[color:var(--crm-ui-text)]">
                            Evidence from {card.basedOnJobCountLabel}
                          </div>
                          {card.evidence.map((evidence) => (
                            <div key={evidence}>{evidence}</div>
                          ))}
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <CrmButton
                            type="button"
                            tone="secondary"
                            disabled={isPending}
                            onClick={() => void dismissRecommendation(card.id)}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <X size={15} aria-hidden="true" />
                              <span>
                                {pendingAction === 'dismiss' ? 'Dismissing' : 'Dismiss'}
                              </span>
                            </span>
                          </CrmButton>
                          <CrmButton
                            type="button"
                            tone="primary"
                            disabled={isPending}
                            onClick={() => void applyRecommendation(card.id)}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Check size={15} aria-hidden="true" />
                              <span>
                                {pendingAction === 'apply' ? 'Applying' : 'Apply'}
                              </span>
                            </span>
                          </CrmButton>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <CrmEmptyState
                  title="No open recommendations"
                  description="Generate cards from the current trend filters to review suggested setting changes."
                  action={
                    <CrmButton
                      type="button"
                      onClick={() => void generateRecommendations()}
                      tone="primary"
                      disabled={recommendationActionState.generating}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles size={15} aria-hidden="true" />
                        <span>
                          {recommendationActionState.generating
                            ? 'Generating'
                            : 'Generate recommendations'}
                        </span>
                      </span>
                    </CrmButton>
                  }
                />
              )}
            </CrmSectionCard>
          </div>
        ) : null}
      </CrmResourceState>
    </CrmPageShell>
  )
}
