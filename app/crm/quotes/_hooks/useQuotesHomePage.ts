'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchJobList, type JobSummary } from '@/lib/jobs/client'
import {
  removeQuoteEstimateFromHomeData,
  type QuoteHomeData,
  type QuoteHomeEstimate,
} from '@/lib/quotes/collectionData'
import { deleteQuoteVersion, loadQuoteHome } from '@/lib/quotes/client'
import {
  deriveQuoteVersionsForJob,
  filterEligibleQuoteVersionJobs,
  type EligibleQuoteVersionJob,
} from '@/lib/quotes/versionCreation'
import { buildSearchHaystack, buildSummaryCards } from '../_home/quoteHomePresentation'
import { useQuoteVersionCreation } from './useQuoteVersionCreation'

type QuoteHomeEligibleJob = EligibleQuoteVersionJob<JobSummary>

const EMPTY_SUMMARY = {
  draft_count: 0,
  sent_or_awaiting_count: 0,
  live_count: 0,
  pipeline_total: 0,
}

export function useQuotesHomePage() {
  const [data, setData] = useState<QuoteHomeData | null>(null)
  const [jobs, setJobs] = useState<QuoteHomeEligibleJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [jobQuery, setJobQuery] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState<QuoteHomeEstimate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [homePayload, jobsPayload] = await Promise.all([
          loadQuoteHome<QuoteHomeData>(),
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

  function requestDeleteVersion(estimate: QuoteHomeEstimate) {
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
        return removeQuoteEstimateFromHomeData(previous, deletedId)
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
