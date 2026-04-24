'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { QuoteHomeJob } from '../_home/quoteHomeTypes'
import { resolveQuoteHomeSelectedJobId } from './quoteHomePagePolicy'

export function useQuoteHomePageState(
  jobs: QuoteHomeJob[],
  initialSelectedJobId: string
) {
  const [jobsForSelection, setJobsForSelectionState] = useState(jobs)
  const [searchQuery, setSearchQueryState] = useState('')
  const [searchFocused, setSearchFocusedState] = useState(false)
  const [jobQuery, setJobQueryState] = useState('')
  const [selectedJobId, setSelectedJobIdState] = useState(() =>
    resolveQuoteHomeSelectedJobId(jobs, initialSelectedJobId)
  )

  useEffect(() => {
    const nextSelectedJobId = resolveQuoteHomeSelectedJobId(jobsForSelection, selectedJobId)
    if (nextSelectedJobId !== selectedJobId) {
      setSelectedJobIdState(nextSelectedJobId)
    }
  }, [jobsForSelection, selectedJobId])

  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryState(value)
  }, [])

  const setSearchFocused = useCallback((value: boolean) => {
    setSearchFocusedState(value)
  }, [])

  const setJobQuery = useCallback((value: string) => {
    setJobQueryState(value)
  }, [])

  const setSelectedJobId = useCallback((value: string) => {
    setSelectedJobIdState(value)
  }, [])

  const setJobsForSelection = useCallback((value: QuoteHomeJob[]) => {
    setJobsForSelectionState(value)
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
    selectedJobId,
    actions,
    setJobsForSelection,
  }
}
