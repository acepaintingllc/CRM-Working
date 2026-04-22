'use client'

import { useState } from 'react'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { useCrmHomeData } from './useCrmHomeData'
import { ActivityFeedCard } from './components/ActivityFeedCard'
import { HomeMetricsGrid } from './components/HomeMetricsGrid'
import { HomeSearchBox } from './components/HomeSearchBox'
import { HomeStatusBanner } from './components/HomeStatusBanner'
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
    <CrmPageShell className="max-w-6xl gap-5">
      <CrmPageHeader
        eyebrow={viewModel.topBar.todayLabel}
        emoji="🏠"
        title={viewModel.topBar.greeting}
        description="Shared CRM dashboard for pipeline health, activity, reminders, and quick actions."
        actions={
          <div className="w-full max-w-[320px] sm:w-[320px]">
            <HomeSearchBox
              query={viewModel.topBar.search.query}
              onQueryChange={setSearch}
              sections={viewModel.topBar.search.sections}
              isOpen={viewModel.topBar.search.isOpen}
            />
          </div>
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
    </CrmPageShell>
  )
}
