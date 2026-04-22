'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchJobList, type JobSummary } from '@/lib/jobs/client'
import { deleteQuoteVersion, loadQuoteHome } from '@/lib/quotes/client'
import {
  deriveQuoteVersionsForJob,
  filterEligibleQuoteVersionJobs,
  type EligibleQuoteVersionJob,
} from '@/lib/quotes/versionCreation'
import { buildSearchHaystack, buildSummaryCards } from '../_home/quoteHomePresentation'
import type { HomeData, HomeEstimate } from '../_home/quoteHomeTypes'
import { useQuoteVersionCreation } from './useQuoteVersionCreation'

type QuoteHomeEligibleJob = EligibleQuoteVersionJob<JobSummary>

const EMPTY_SUMMARY = {
  draft_count: 0,
  sent_or_awaiting_count: 0,
  live_count: 0,
  pipeline_total: 0,
}

function recomputeSummary(estimates: HomeEstimate[]) {
  return {
    draft_count: estimates.filter((row) => row.version_state === 'draft').length,
    sent_or_awaiting_count: estimates.filter((row) => row.is_sent_estimate).length,
    live_count: estimates.filter((row) => row.version_state === 'live').length,
    pipeline_total: estimates.reduce((sum, row) => {
      if (row.version_state === 'archived') return sum
      return sum + (row.final_total ?? 0)
    }, 0),
  }
}

function deriveSnapshot(
  previousSnapshot: HomeData['snapshot'],
  remainingSearch: HomeEstimate[],
  deletedId: string
) {
  if (previousSnapshot?.estimate_id !== deletedId) return previousSnapshot
  const nextSnapshot = remainingSearch[0]
  return nextSnapshot
    ? {
        ...nextSnapshot,
        total_versions: remainingSearch.length,
      }
    : null
}

export function useQuotesHomePage() {
  const [data, setData] = useState<HomeData | null>(null)
  const [jobs, setJobs] = useState<QuoteHomeEligibleJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [jobQuery, setJobQuery] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState<HomeEstimate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [homePayload, jobsPayload] = await Promise.all([
          loadQuoteHome<HomeData>(),
          fetchJobList(),
        ])

        if (!active) return

        const eligibleJobs = filterEligibleQuoteVersionJobs(jobsPayload)
        setData(homePayload)
        setJobs(eligibleJobs)
        setSelectedJobId((current) => {
          if (current && eligibleJobs.some((job) => job.id === current)) return current
          return eligibleJobs[0]?.id ?? ''
        })
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load quotes home.')
        setData(null)
        setJobs([])
        setSelectedJobId('')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null
  const createController = useQuoteVersionCreation(selectedJob)

  const summaryCards = useMemo(() => buildSummaryCards(data), [data])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return (data?.search_estimates ?? [])
      .filter((estimate) => buildSearchHaystack(estimate).includes(q))
      .slice(0, 8)
  }, [data, searchQuery])

  const heroSummaryText = data
    ? `${data.search_estimates.length} total versions | ${data.summary.draft_count} drafts | ${data.summary.sent_or_awaiting_count} sent/awaiting | ${data.summary.live_count} live`
    : 'Build and track quote versions with live status, totals, and search.'

  const filteredJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((job) => {
      const haystack = `${job.title} ${job.customer_name ?? ''} ${job.customer_address ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [jobQuery, jobs])

  const selectedJobVersions = useMemo(
    () => deriveQuoteVersionsForJob(data?.search_estimates ?? [], selectedJobId),
    [data, selectedJobId]
  )

  const versionCountByJob = useMemo(() => {
    const map: Record<string, number> = {}
    for (const estimate of data?.search_estimates ?? []) {
      map[estimate.job_id] = (map[estimate.job_id] ?? 0) + 1
    }
    return map
  }, [data])

  const mobileSummaryCards = useMemo(() => [summaryCards[0], summaryCards[3]].filter(Boolean), [summaryCards])

  function requestDeleteVersion(estimate: HomeEstimate) {
    setConfirmingDelete(estimate)
  }

  function cancelDelete() {
    if (deletingId) return
    setConfirmingDelete(null)
  }

  async function confirmDeleteVersion() {
    if (!confirmingDelete) return

    const deletedId = confirmingDelete.estimate_id
    setDeletingId(deletedId)
    setError(null)

    try {
      await deleteQuoteVersion(deletedId)
      setData((previous) => {
        if (!previous) return previous

        const remainingRecent = previous.recent_estimates.filter((row) => row.estimate_id !== deletedId)
        const remainingSearch = previous.search_estimates.filter((row) => row.estimate_id !== deletedId)

        return {
          ...previous,
          recent_estimates: remainingRecent,
          search_estimates: remainingSearch,
          snapshot: deriveSnapshot(previous.snapshot, remainingSearch, deletedId),
          summary: recomputeSummary(remainingSearch),
        }
      })
      setConfirmingDelete(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete quote.')
    } finally {
      setDeletingId(null)
    }
  }

  return {
    feedbackVm: {
      loading,
      error: error ?? createController.error,
      hasData: Boolean(data),
      summary: data?.summary ?? EMPTY_SUMMARY,
    },
    headerVm: {
      searchQuery,
      searchFocused,
      searchResults,
      heroSummaryText,
    },
    summaryCards,
    mobileVm: {
      summaryCards: mobileSummaryCards,
      jobs: jobs.slice(0, 10),
    },
    jobListVm: {
      loading,
      jobs,
      filteredJobs,
      jobQuery,
      selectedJobId,
      versionCountByJob,
    },
    selectedJobVm: {
      loading,
      selectedJob,
      selectedJobVersionsCount: selectedJobVersions.length,
    },
    versionListVm: {
      selectedJob,
      versions: selectedJobVersions,
      deletingId,
    },
    createVm: {
      loading,
      creating: createController.creating,
      selectedJob,
      versionName: createController.versionName,
      versionKind: createController.versionKind,
    },
    deleteDialogVm: {
      estimate: confirmingDelete,
      deletingId,
    },
    actions: {
      setSearchQuery,
      setSearchFocused,
      setJobQuery,
      setSelectedJobId,
      setVersionName: createController.setVersionName,
      setVersionKind: createController.setVersionKind,
      createVersion: createController.createVersion,
      requestDeleteVersion,
      cancelDelete,
      confirmDeleteVersion,
    },
  }
}
