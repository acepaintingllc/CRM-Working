'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { QuoteHomeJob } from '../_home/quoteHomeTypes'
import {
  resolveQuoteHomeSelection,
} from './quoteHomePagePolicy'

export function useQuoteHomePageState(
  jobs: QuoteHomeJob[],
  initialSelectedJobId: string
) {
  const [jobsForSelection, setJobsForSelectionState] = useState(jobs)
  const [jobsForSelectionQuery, setJobsForSelectionQuery] = useState('')
  const [searchQuery, setSearchQueryState] = useState('')
  const [searchFocused, setSearchFocusedState] = useState(false)
  const [jobQuery, setJobQueryState] = useState('')
  const [selection, setSelection] = useState(() =>
    resolveQuoteHomeSelection({
      event: 'initialize',
      jobs,
      selectedJobId: initialSelectedJobId,
    })
  )

  useEffect(() => {
    setSelection((currentSelection) =>
      resolveQuoteHomeSelection({
        event: 'loaded_jobs_changed',
        jobs: jobsForSelection,
        currentSelection,
        jobQuery: jobsForSelectionQuery,
      })
    )
  }, [jobsForSelection, jobsForSelectionQuery])

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
          jobs: jobsForSelection,
          selectedJobId: value,
        })
      )
    },
    [jobsForSelection]
  )

  const reconcileLoadedJobs = useCallback((value: QuoteHomeJob[], query = '') => {
    setJobsForSelectionState(value)
    setJobsForSelectionQuery(query)
  }, [])

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
