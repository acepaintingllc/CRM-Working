'use client'

import { useCallback, useEffect, useState } from 'react'
import { readStoredCalendarIds } from '@/lib/crm/home/calendar'
import { fetchCrmHomeSource } from '@/lib/crm/home/client'
import { loadCrmHomeData, loadCrmHomeSources } from '@/lib/crm/home/loader'
import {
  applyCrmHomeSourcePatch,
  createInitialCrmHomeLoadState,
  createLoadingCrmHomeLoadState,
} from '@/lib/crm/home/state'
import type { CrmHomeSourceErrorKey } from '@/lib/crm/home/types'

function logSourceError(source: CrmHomeSourceErrorKey, message: string, detail?: unknown) {
  console.error(`[CRM HOME:${source}] ${message}`, detail)
}

const homeDataDeps = {
  fetchJson: fetchCrmHomeSource,
  readSelectedCalendarIds: readStoredCalendarIds,
  logError: logSourceError,
}

export function useCrmHomeData() {
  const [state, setState] = useState(() => createInitialCrmHomeLoadState())

  const reloadAll = useCallback(async () => {
    setState((current) =>
      createLoadingCrmHomeLoadState(current, [
        'jobs',
        'customers',
        'calendarStatus',
        'calendarEvents',
        'tasks',
      ])
    )

    const nextState = await loadCrmHomeData(homeDataDeps)

    setState(nextState)
  }, [])

  const refreshSource = useCallback(async (source: CrmHomeSourceErrorKey) => {
    const sourceKeys =
      source === 'calendarStatus' || source === 'calendarEvents'
        ? (['calendarStatus', 'calendarEvents'] as CrmHomeSourceErrorKey[])
        : ([source] as CrmHomeSourceErrorKey[])

    setState((current) => createLoadingCrmHomeLoadState(current, sourceKeys))

    const patch = await loadCrmHomeSources(homeDataDeps, sourceKeys)
    setState((current) => applyCrmHomeSourcePatch(current, patch))
  }, [])

  useEffect(() => {
    void reloadAll()
  }, [reloadAll])

  return {
    data: state.data,
    sources: state.sources,
    summary: state.summary,
    reloadAll,
    refreshSource,
  }
}
