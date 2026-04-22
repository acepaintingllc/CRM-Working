import { createJobStatusBuckets, type JobStatus } from './types.ts'
import type { JobSummary } from './client.ts'

export type JobActivityItem = {
  label: string
  at: string
}

export function groupJobsByStatus(jobs: JobSummary[]) {
  const grouped = createJobStatusBuckets<JobSummary>()
  for (const job of jobs) {
    grouped[job.status]?.push(job)
  }
  return grouped
}

export function deriveJobActivitySummary(job: JobSummary): JobActivityItem[] {
  const items: JobActivityItem[] = []
  if (job.completed_email_sent_at) items.push({ label: 'Review email sent', at: job.completed_email_sent_at })
  if (job.completed_at) items.push({ label: 'Completed', at: job.completed_at })
  if (job.scheduled_email_sent_at) items.push({ label: 'Confirmation email sent', at: job.scheduled_email_sent_at })
  if (job.scheduled_date) items.push({ label: 'Scheduled', at: job.scheduled_date })
  if (job.estimate_sent_at) items.push({ label: 'Quote sent', at: job.estimate_sent_at })
  if (job.estimate_date) items.push({ label: 'Estimate set', at: job.estimate_date })
  if (job.created_at) items.push({ label: 'Job created', at: job.created_at })
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return items.slice(0, 2)
}

export function matchesCompletedJobQuery(job: JobSummary, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  const address = job.customer_address ?? ''
  const streetOnly = address.split(',')[0] ?? address
  const haystack =
    `${job.title} ${job.customer_name ?? ''} ${address} ${streetOnly} ${job.description ?? ''}`.toLowerCase()
  return haystack.includes(normalizedQuery)
}

export function sortCompletedJobs(jobs: JobSummary[]) {
  return [...jobs].sort((a, b) => {
    const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0
    const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0
    return bTime - aTime
  })
}

export function filterCompletedJobs(params: {
  jobs: JobSummary[]
  query: string
  showAll: boolean
}) {
  const filtered = sortCompletedJobs(params.jobs).filter((job) =>
    matchesCompletedJobQuery(job, params.query)
  )
  if (!params.showAll && !params.query.trim()) {
    return filtered.slice(0, 5)
  }
  return filtered
}

export function getVisibleJobBoardColumns(params: {
  columns: Array<{ key: JobStatus; title: string }>
  grouped: ReturnType<typeof groupJobsByStatus>
  showCompleted: boolean
  showLost: boolean
  showEmptyStages: boolean
}) {
  return params.columns
    .filter((column) =>
      column.key === 'completed'
        ? params.showCompleted
        : column.key === 'lost'
          ? params.showLost
          : true
    )
    .filter((column) => params.showEmptyStages || params.grouped[column.key].length > 0)
}
