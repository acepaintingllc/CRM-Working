'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { QuoteHomeJob } from '../_home/quoteHomeTypes'
import {
  resolveQuoteHomeManualSelection,
  resolveQuoteHomeSelectedJob,
  resolveQuoteHomeSelectionAfterJobsLoaded,
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
    resolveQuoteHomeSelectedJob(jobs, initialSelectedJobId)
  )

  useEffect(() => {
    setSelection((currentSelection) =>
      resolveQuoteHomeSelectionAfterJobsLoaded({
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
      setSelection(resolveQuoteHomeManualSelection({
        jobs: jobsForSelection,
        selectedJobId: value,
      }))
    },
    [jobsForSelection]
  )

  const setJobsForSelection = useCallback((value: QuoteHomeJob[], query = '') => {
    setJobsForSelectionState(value)
    setJobsForSelectionQuery(query)
  }, [])

  const actions = useMemo(
    () => ({
      setSearchQuery,
      setSearchFocused,
      setJobQuery,
      setSelectedJobId,
      setJobsForSelection,
    }),
    [
      setJobQuery,
      setJobsForSelection,
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
    setJobsForSelection,
  }
}
