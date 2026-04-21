'use client'

import { useState } from 'react'
import { useCrmHomeData } from './useCrmHomeData'
import { ActivityFeedCard } from './components/ActivityFeedCard'
import { HomeMetricsGrid } from './components/HomeMetricsGrid'
import { HomeSearchBox } from './components/HomeSearchBox'
import { HomeStatusBanner } from './components/HomeStatusBanner'
import { HomeTopBar } from './components/HomeTopBar'
import { QuickActionsCard } from './components/QuickActionsCard'
import { TodaySignalsCard } from './components/TodaySignalsCard'
import { buildCrmHomePageViewModel } from './viewModel'

export function CrmHomePageContent() {
  const { data, sources, summary, reloadAll } = useCrmHomeData()
  const [search, setSearch] = useState('')
  const viewModel = buildCrmHomePageViewModel({
    data,
    sources,
    summary,
    search,
  })

  return (
    <div className="min-h-full py-5 md:py-7" style={{ background: 'var(--crm-bg)' }}>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 md:gap-5 md:px-6">
        <HomeTopBar
          todayLabel={viewModel.topBar.todayLabel}
          greeting={viewModel.topBar.greeting}
          searchBox={
            <HomeSearchBox
              query={viewModel.topBar.search.query}
              onQueryChange={setSearch}
              sections={viewModel.topBar.search.sections}
              isOpen={viewModel.topBar.search.isOpen}
            />
          }
        />

        {summary.isInitialLoading ? (
          <div role="status" aria-live="polite" className="sr-only">
            Loading...
          </div>
        ) : null}

        <HomeStatusBanner
          viewModel={viewModel.statusBanner}
          isBusy={summary.isBusy}
          onRetry={() => void reloadAll()}
        />

        <HomeMetricsGrid viewModel={viewModel.metrics} />
        <QuickActionsCard viewModel={viewModel.quickActions} />

        <div className="grid gap-4 lg:grid-cols-2">
          <ActivityFeedCard viewModel={viewModel.activity} />
          <TodaySignalsCard viewModel={viewModel.signals} />
        </div>
      </div>
    </div>
  )
}
