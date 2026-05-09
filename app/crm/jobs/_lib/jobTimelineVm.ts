import {
  next8amLocalDateTimeValue,
  toIsoFromLocalDateTimeValue,
  toLocalDateTimeInputValue,
} from '@/lib/jobs/dateHelpers'
import type { JobDetail } from '@/types/jobs/api'

export type JobTimelineItemIconKey =
  | 'calendar'
  | 'check'
  | 'circle'
  | 'eye'
  | 'mail'
  | 'send'

export type JobTimelineItem = {
  key: string
  iconKey: JobTimelineItemIconKey
  label: string
  value: string
  at: string | null
  href?: string | null
  linkLabel?: string | null
  estimateDateInputValue?: string
}

type TimelineItemDraft = JobTimelineItem & {
  order: number
}

export function formatJobTimelineDate(iso: string | null | undefined) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function formatJobTimelineRange(start?: string | null, end?: string | null) {
  if (!start && !end) return '-'
  if (start && end) return `${formatJobTimelineDate(start)} - ${formatJobTimelineDate(end)}`
  if (start) return `${formatJobTimelineDate(start)} -`
  return `- ${formatJobTimelineDate(end)}`
}

export function jobTimelineDateTimeLocalToIso(value: string) {
  return toIsoFromLocalDateTimeValue(value)
}

function quoteEventIconKey(type: string | null | undefined): JobTimelineItemIconKey {
  if (type === 'quote_sent' || type === 'quote_resent') return 'send'
  if (type === 'quote_viewed') return 'eye'
  if (type === 'quote_accepted') return 'check'
  return 'circle'
}

function estimateDateInputValue(estimateDate: string | null | undefined) {
  return estimateDate
    ? toLocalDateTimeInputValue(new Date(estimateDate))
    : next8amLocalDateTimeValue()
}

export function buildJobTimelineItems(job: JobDetail): JobTimelineItem[] {
  const baseItems: TimelineItemDraft[] = [
    {
      key: 'created_at',
      iconKey: 'circle',
      label: 'Created',
      value: formatJobTimelineDate(job.created_at),
      at: job.created_at ?? null,
      order: 0,
    },
    {
      key: 'estimate_date',
      iconKey: 'calendar',
      label: 'Quote date',
      value: formatJobTimelineDate(job.estimate_date),
      at: job.estimate_date ?? null,
      order: 1,
      estimateDateInputValue: estimateDateInputValue(job.estimate_date),
    },
    {
      key: 'estimate_sent_at',
      iconKey: 'send',
      label: 'Quote sent',
      value: formatJobTimelineDate(job.estimate_sent_at),
      at: job.estimate_sent_at ?? null,
      order: 2,
    },
    {
      key: 'scheduled_range',
      iconKey: 'calendar',
      label: 'Scheduled job date range',
      value: formatJobTimelineRange(job.scheduled_date, job.scheduled_end_date),
      at: job.scheduled_date ?? job.scheduled_end_date ?? null,
      order: 3,
    },
    {
      key: 'scheduled_email_sent_at',
      iconKey: 'mail',
      label: 'Confirmation email sent',
      value: formatJobTimelineDate(job.scheduled_email_sent_at),
      at: job.scheduled_email_sent_at ?? null,
      order: 4,
    },
    {
      key: 'completed_at',
      iconKey: 'check',
      label: 'Completed at',
      value: formatJobTimelineDate(job.completed_at),
      at: job.completed_at ?? null,
      order: 5,
    },
    {
      key: 'completed_email_sent_at',
      iconKey: 'mail',
      label: 'Review email sent',
      value: formatJobTimelineDate(job.completed_email_sent_at),
      at: job.completed_email_sent_at ?? null,
      order: 6,
    },
  ]

  const quoteItems: TimelineItemDraft[] = (job.public_quote_timeline_events ?? []).map(
    (event, index) => ({
      key: event.id || `${event.type || 'quote-event'}-${event.created_at ?? index}-${index}`,
      iconKey: quoteEventIconKey(event.type),
      label: event.title || 'Quote activity',
      value: event.body || formatJobTimelineDate(event.created_at),
      at: event.created_at ?? null,
      order: 20 + index,
      href: event.link_path,
      linkLabel: event.link_label,
    })
  )

  return [...baseItems, ...quoteItems]
    .sort((a, b) => {
      if (a.at && b.at) return b.at.localeCompare(a.at)
      if (a.at) return -1
      if (b.at) return 1
      return a.order - b.order
    })
    .map((item) => item)
}
