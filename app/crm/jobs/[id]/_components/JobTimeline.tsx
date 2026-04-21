'use client'

import {
  next8amLocalDateTimeValue,
  toIsoFromLocalDateTimeValue,
  toLocalDateTimeInputValue,
} from '@/lib/jobs/dateHelpers'
import type { JobDetail } from '@/lib/jobs/actions'
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Mail,
  Send,
  type LucideIcon,
} from 'lucide-react'

const iconSizeSm = 16

type TimelineItem = {
  key: string
  label: string
  value: string
  at: string | null
  order: number
}

type JobTimelineProps = {
  job: JobDetail
  open: boolean
  onToggle: () => void
  onEstimateDateChange: (iso: string) => void
  formatDate: (iso: string | null | undefined) => string
  formatRange: (start?: string | null, end?: string | null) => string
}

function timelineIconForItem(key: string): LucideIcon {
  if (key === 'estimate_date') return CalendarCheck
  if (key === 'estimate_sent_at') return Send
  if (key === 'scheduled_range') return CalendarCheck
  if (key === 'scheduled_email_sent_at') return Mail
  if (key === 'completed_at') return CheckCircle2
  if (key === 'completed_email_sent_at') return Mail
  return Circle
}

function buildTimelineItems(
  job: JobDetail,
  formatDate: (iso: string | null | undefined) => string,
  formatRange: (start?: string | null, end?: string | null) => string
): TimelineItem[] {
  return [
    {
      key: 'created_at',
      label: 'Created',
      value: formatDate(job.created_at),
      at: job.created_at ?? null,
      order: 0,
    },
    {
      key: 'estimate_date',
      label: 'Quote date',
      value: formatDate(job.estimate_date),
      at: job.estimate_date ?? null,
      order: 1,
    },
    {
      key: 'estimate_sent_at',
      label: 'Quote sent',
      value: formatDate(job.estimate_sent_at),
      at: job.estimate_sent_at ?? null,
      order: 2,
    },
    {
      key: 'scheduled_range',
      label: 'Scheduled job date range',
      value: formatRange(job.scheduled_date, job.scheduled_end_date),
      at: job.scheduled_date ?? job.scheduled_end_date ?? null,
      order: 3,
    },
    {
      key: 'scheduled_email_sent_at',
      label: 'Confirmation email sent',
      value: formatDate(job.scheduled_email_sent_at),
      at: job.scheduled_email_sent_at ?? null,
      order: 4,
    },
    {
      key: 'completed_at',
      label: 'Completed at',
      value: formatDate(job.completed_at),
      at: job.completed_at ?? null,
      order: 5,
    },
    {
      key: 'completed_email_sent_at',
      label: 'Review email sent',
      value: formatDate(job.completed_email_sent_at),
      at: job.completed_email_sent_at ?? null,
      order: 6,
    },
  ].sort((a, b) => {
    if (a.at && b.at) return b.at.localeCompare(a.at)
    if (a.at) return -1
    if (b.at) return 1
    return a.order - b.order
  })
}

export default function JobTimeline({
  job,
  open,
  onToggle,
  onEstimateDateChange,
  formatDate,
  formatRange,
}: JobTimelineProps) {
  const timelineItems = buildTimelineItems(job, formatDate, formatRange)

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5">
          {open ? (
            <ChevronDown size={iconSizeSm} aria-hidden="true" />
          ) : (
            <ChevronRight size={iconSizeSm} aria-hidden="true" />
          )}
          <span>Timeline</span>
        </span>
        <span>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="relative mt-3 pl-8">
          <div className="absolute bottom-0 left-3 top-0 w-px bg-gray-200" aria-hidden="true" />
          <div className="grid gap-2.5">
            {timelineItems.map((item) => {
              const ItemIcon = timelineIconForItem(item.key)
              const isSet = item.at != null
              return (
                <div key={item.key} className="relative">
                  <div
                    className={`absolute left-[-23px] top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                      isSet
                        ? 'border-gray-400 bg-white text-gray-700'
                        : 'border-gray-300 bg-white text-gray-400'
                    }`}
                    aria-hidden="true"
                  >
                    <ItemIcon size={12} />
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">
                      {item.label}
                    </div>
                    <div
                      className={`mt-1 text-sm font-semibold ${
                        isSet ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {isSet ? item.value : 'Not set'}
                    </div>
                    {item.key === 'estimate_date' && (
                      <input
                        type="datetime-local"
                        defaultValue={
                          job.estimate_date
                            ? toLocalDateTimeInputValue(new Date(job.estimate_date))
                            : next8amLocalDateTimeValue()
                        }
                        onChange={(event) => {
                          if (!event.target.value) return
                          const iso = toIsoFromLocalDateTimeValue(event.target.value)
                          if (!iso) return
                          onEstimateDateChange(iso)
                        }}
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none ring-black/70 focus:ring-2"
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
