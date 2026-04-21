'use client'

import { useDeferredValue, useState } from 'react'
import { buildSearchResults } from '@/lib/crm/home/selectors'
import { useCrmHomeData } from './useCrmHomeData'
import { ActivityFeedCard } from './components/ActivityFeedCard'
import { HomeMetricsGrid } from './components/HomeMetricsGrid'
import { HomeStatusBanner } from './components/HomeStatusBanner'
import { HomeTopBar } from './components/HomeTopBar'
import { QuickActionsCard } from './components/QuickActionsCard'
import { TodaySignalsCard } from './components/TodaySignalsCard'

export function CrmHomePageContent() {
  const {
    data,
    errorsBySource,
    isInitialLoading,
    isReloading,
    hasCriticalError,
    hasWarnings,
    reload,
  } = useCrmHomeData()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const searchResults = buildSearchResults(data.customers, data.jobs, deferredSearch)
  const isBusy = isInitialLoading || isReloading

  return (
    <div className="min-h-full py-5 md:py-7" style={{ background: 'var(--crm-bg)' }}>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 md:gap-5 md:px-6">
        <HomeTopBar
          todayLabel={data.todayLabel}
          greeting={data.greeting}
          search={search}
          onSearchChange={setSearch}
          searchResults={searchResults}
        />

        <HomeStatusBanner
          errorsBySource={errorsBySource}
          hasCriticalError={hasCriticalError}
          hasWarnings={hasWarnings}
          isBusy={isBusy}
          onRetry={() => void reload()}
        />

        <HomeMetricsGrid metrics={data.metrics} />
        <QuickActionsCard />

        <div className="grid gap-4 lg:grid-cols-2">
          <ActivityFeedCard jobs={data.activityJobs} totalJobs={data.jobs.length} />
          <TodaySignalsCard
            loading={isInitialLoading}
            calendarConnected={data.signals.calendarConnected}
            calendarError={errorsBySource.calendarEvents ?? errorsBySource.calendarStatus ?? null}
            calendarTodayEvents={data.signals.calendarTodayEvents}
            notesReminders={data.signals.notesReminders}
          />
        </div>
      </div>
    </div>
  )
}
