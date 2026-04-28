import Link from 'next/link'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { formatStatus } from '@/lib/crm/home/formatters'
import { DashboardCardShell } from './primitives/DashboardCardShell'
import { DashboardDividedList } from './primitives/DashboardDividedList'
import { DashboardSectionHeader } from './primitives/DashboardSectionHeader'
import { crmMutedTextStyle, crmTextStyle } from './primitives/tokens'

type CurrentJobsCardProps = {
  viewModel: {
    items: Array<{
      id: string
      href: string
      title: string
      customerName: string
      scheduleLabel: string
      status: string | null
    }>
    isEmpty: boolean
  }
}

export function CurrentJobsCard({ viewModel }: CurrentJobsCardProps) {
  if (viewModel.isEmpty) return null

  return (
    <DashboardCardShell className="crm-current-jobs-card">
      <DashboardSectionHeader label="Current jobs" />
      <DashboardDividedList className="mt-2">
        {viewModel.items.map((job, index) => (
          <Link
            key={job.id}
            href={job.href}
            className={`group flex min-w-0 items-start gap-3 py-3 no-underline ${index >= 2 ? 'hidden md:flex' : ''}`}
          >
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--crm-ui-accent-soft)', color: 'var(--crm-ui-accent)' }}
            >
              <CalendarClock size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold" style={crmTextStyle}>
                {job.title}
              </div>
              <div className="mt-0.5 truncate text-xs" style={crmMutedTextStyle}>
                {job.customerName}
              </div>
              <div className="mt-1 text-xs leading-5" style={crmMutedTextStyle}>
                {job.scheduleLabel}
              </div>
            </div>
            <div className="hidden shrink-0 items-center gap-1 text-xs font-semibold sm:inline-flex" style={crmMutedTextStyle}>
              {formatStatus(job.status)}
              <ArrowRight size={12} aria-hidden="true" />
            </div>
          </Link>
        ))}
      </DashboardDividedList>
    </DashboardCardShell>
  )
}
