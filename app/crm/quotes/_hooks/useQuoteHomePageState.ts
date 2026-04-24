'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { QuoteHomeJob } from '../_home/quoteHomeTypes'
import {
  normalizeQuoteHomeJobQuery,
  resolveQuoteHomeLoadedJobsChangeKind,
  resolveQuoteHomeSelection,
} from './quoteHomePagePolicy'

type LoadedJobsSelectionContext = {
  jobs: QuoteHomeJob[]
  jobQuery: string
}

export function useQuoteHomePageState(
  jobs: QuoteHomeJob[],
  initialSelectedJobId: string
) {
  const [searchQuery, setSearchQueryState] = useState('')
  const [searchFocused, setSearchFocusedState] = useState(false)
  const [jobQuery, setJobQueryState] = useState('')
  const loadedJobsContextRef = useRef<LoadedJobsSelectionContext>({
    jobs,
    jobQuery: '',
  })
  const [selection, setSelection] = useState(() =>
    resolveQuoteHomeSelection({
      event: 'initialize',
      jobs,
      selectedJobId: initialSelectedJobId,
    })
  )

  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryState(value)
  }, [])

  const setSearchFocused = useCallback((value: boolean) => {
    setSearchFocusedState(value)
  }, [])

  const setJobQuery = useCallback((value: string) => {
    setJobQueryState(value)
  }, [])

  const setSelectedJobId = useCallback(
    (value: string) => {
      setSelection(
        resolveQuoteHomeSelection({
          event: 'manual_select',
          jobs: loadedJobsContextRef.current.jobs,
          selectedJobId: value,
        })
      )
    },
    []
  )

  const reconcileLoadedJobs = useCallback(
    (
      value: QuoteHomeJob[],
      query = '',
      options?: { preferredSelectedJobId?: string | null | undefined }
    ) => {
      const normalizedQuery = normalizeQuoteHomeJobQuery(query)
      const previousContext = loadedJobsContextRef.current
      const changeKind = resolveQuoteHomeLoadedJobsChangeKind({
        previousJobs: previousContext.jobs,
        previousJobQuery: previousContext.jobQuery,
        jobs: value,
        jobQuery: normalizedQuery,
      })

      loadedJobsContextRef.current = {
        jobs: value,
        jobQuery: normalizedQuery,
      }
      setSelection((currentSelection) =>
        resolveQuoteHomeSelection(
          changeKind === 'jobs_appended'
            ? {
                event: 'jobs_appended',
                jobs: value,
                currentSelection,
              }
            : {
                event: 'jobs_replaced',
                jobs: value,
                currentSelection,
                jobQuery: normalizedQuery,
                preferredSelectedJobId: options?.preferredSelectedJobId,
              }
        )
      )
    },
    []
  )

  const actions = useMemo(
    () => ({
      setSearchQuery,
      setSearchFocused,
      setJobQuery,
      setSelectedJobId,
      reconcileLoadedJobs,
    }),
    [
      setJobQuery,
      reconcileLoadedJobs,
      setSearchFocused,
      setSearchQuery,
      setSelectedJobId,
    ]
  )

  return {
    searchQuery,
    searchFocused,
    jobQuery,
    selectedJobId: selection.selectedJobId,
    selectedJob: selection.selectedJob,
    actions,
    reconcileLoadedJobs,
  }
}
