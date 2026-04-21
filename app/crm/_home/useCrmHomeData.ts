'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useCallback, useEffect, useRef, useState } from 'react'
import { readStoredCalendarIds } from '@/lib/crm/home/calendar'
import { loadCrmHomeData } from '@/lib/crm/home/loader'
import {
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
  const hasLoadedOnceRef = useRef(false)

  const load = useCallback(async () => {
    setState((current) => createLoadingCrmHomeLoadState(current.data, hasLoadedOnceRef.current))

    const nextState = await loadCrmHomeData({
      fetchJson,
      readSelectedCalendarIds: readStoredCalendarIds,
      logError: logSourceError,
    })

    setState(nextState)
    hasLoadedOnceRef.current = true
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return {
    data: state.data,
    errorsBySource: state.errorsBySource,
    isInitialLoading: state.isInitialLoading,
    isReloading: state.isReloading,
    hasCriticalError: state.hasCriticalError,
    hasWarnings: state.hasWarnings,
    reload: load,
  }
}
