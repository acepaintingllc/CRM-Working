import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { formatCurrency, formatStatus } from '@/lib/crm/home/formatters'
import type { DashboardJob } from '@/lib/crm/home/types'

type ActivityFeedCardProps = {
  jobs: DashboardJob[]
  totalJobs: number
}

function statusDisplay(job: DashboardJob) {
  if (job.status === 'completed') {
    return {
      badge: '\u2713',
      background: 'var(--crm-success-bg)',
      color: 'var(--crm-success-text)',
    }
  }

  if (job.status === 'lost') {
    return {
      badge: '\u2715',
      background: 'var(--crm-danger-bg)',
      color: 'var(--crm-danger-text)',
    }
  }

  return {
    badge: '\u2022',
    background: 'var(--crm-border)',
    color: 'var(--crm-muted)',
  }
}

export function ActivityFeedCard({ jobs, totalJobs }: ActivityFeedCardProps) {
  return (
    <div
      className="crm-card rounded-2xl border shadow-sm"
      style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
    >
      <div className="flex items-center gap-3 border-b px-5 pt-5 pb-3" style={{ borderColor: 'var(--crm-border)' }}>
        <button
          className="rounded-lg px-3 py-1.5 text-sm font-extrabold"
          style={{ background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }}
        >
          Activity
        </button>
        <Link
          href="/crm/notes/tasks"
          className="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
          style={{ color: 'var(--crm-muted)' }}
        >
          Tasks
        </Link>
      </div>

      <div className="px-5 py-4">
        {jobs.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--crm-muted)' }}>
            No activity yet. Create your first job to get started.
          </div>
        ) : (
          <div className="grid gap-0">
            {jobs.map((job, index) => {
              const status = statusDisplay(job)
              const amount = Number(job.estimate_total_amount)
              return (
                <Link
                  key={job.id}
                  href={`/crm/jobs/${job.id}`}
                  className="group flex gap-3 py-3 transition"
                  style={{
                    borderBottom: index < jobs.length - 1 ? `1px solid var(--crm-border)` : 'none',
                  }}
                >
                  <div
                    className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
                    style={{ background: status.background, color: status.color }}
                  >
                    {status.badge}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>
                      {job.title ?? 'Untitled job'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                        {job.customer_name ?? 'No customer'}
                      </span>
                      {Number.isFinite(amount) && amount > 0 && (
                        <span className="text-xs font-semibold" style={{ color: 'var(--crm-text-soft)' }}>
                          {'\u2022'} {formatCurrency(amount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex-shrink-0 self-center text-xs font-semibold"
                    style={{ color: 'var(--crm-muted)' }}
                  >
                    {formatStatus(job.status)}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {totalJobs > jobs.length && (
          <Link
            href="/crm/jobs"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
            style={{ color: 'var(--crm-muted)' }}
          >
            View all {totalJobs} jobs <ArrowRight size={11} />
          </Link>
        )}
      </div>
    </div>
  )
}
