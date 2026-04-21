'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useCallback, useEffect, useState } from 'react'
import { readStoredCalendarIds } from '@/lib/crm/home/calendar'
import { loadCrmHomeData, loadCrmHomeSources } from '@/lib/crm/home/loader'
import {
  applyCrmHomeSourcePatch,
  createInitialCrmHomeLoadState,
  createLoadingCrmHomeLoadState,
} from '@/lib/crm/home/state'
import type { CrmHomeFetchResponse, CrmHomeSourceErrorKey } from '@/lib/crm/home/types'

function logSourceError(source: CrmHomeSourceErrorKey, message: string, detail?: unknown) {
  console.error(`[CRM HOME:${source}] ${message}`, detail)
}

async function fetchJson(
  source: CrmHomeSourceErrorKey,
  url: string
): Promise<CrmHomeFetchResponse> {
  try {
    const response = await authedFetch(url, { cache: 'no-store' })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const errorMessage =
        (payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
          ? payload.error
          : null) ?? `Request failed with status ${response.status}.`
      return { source, ok: false, payload, errorMessage }
    }
    return { source, ok: true, payload, errorMessage: null }
  } catch (error) {
    return {
      source,
      ok: false,
      payload: null,
      errorMessage: error instanceof Error ? error.message : 'Request failed.',
    }
  }
}

export function useCrmHomeData() {
  const [state, setState] = useState(() => createInitialCrmHomeLoadState())

  const deps = {
    fetchJson,
    readSelectedCalendarIds: readStoredCalendarIds,
    logError: logSourceError,
  }

  const reloadAll = useCallback(async () => {
    setState((current) =>
      createLoadingCrmHomeLoadState(current, [
        'jobs',
        'customers',
        'calendarStatus',
        'calendarEvents',
        'notes',
      ])
    )

    const nextState = await loadCrmHomeData(deps)

    setState(nextState)
  }, [])

  const refreshSource = useCallback(async (source: CrmHomeSourceErrorKey) => {
    const sourceKeys =
      source === 'calendarStatus' || source === 'calendarEvents'
        ? (['calendarStatus', 'calendarEvents'] as CrmHomeSourceErrorKey[])
        : ([source] as CrmHomeSourceErrorKey[])

    setState((current) => createLoadingCrmHomeLoadState(current, sourceKeys))

    const patch = await loadCrmHomeSources(deps, sourceKeys)
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
