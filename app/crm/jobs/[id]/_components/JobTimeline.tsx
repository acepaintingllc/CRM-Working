'use client'

import type { JobTimelineItem, JobTimelineItemIconKey } from '@/app/crm/jobs/_lib/jobTimelineVm'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import {
  crmInputClassName,
  crmSurfaceClassName,
  crmSurfaceMutedClassName,
} from '@/app/crm/_components/crmStyles'
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Eye,
  ExternalLink,
  Mail,
  Send,
  type LucideIcon,
} from 'lucide-react'

const iconSizeSm = 16

type JobTimelineProps = {
  items: JobTimelineItem[]
  open: boolean
  onToggle: () => void
  onEstimateDateChange: (localValue: string) => void
}

function timelineIconForItem(iconKey: JobTimelineItemIconKey): LucideIcon {
  if (iconKey === 'calendar') return CalendarCheck
  if (iconKey === 'send') return Send
  if (iconKey === 'eye') return Eye
  if (iconKey === 'check') return CheckCircle2
  if (iconKey === 'mail') return Mail
  return Circle
}

export default function JobTimeline({
  items,
  open,
  onToggle,
  onEstimateDateChange,
}: JobTimelineProps) {
  return (
    <div className={crmSurfaceMutedClassName('p-3')}>
      <CrmButton
        onClick={onToggle}
        className="w-full min-h-0 px-3 py-2 text-sm"
        aria-expanded={open}
      >
        <span className="flex w-full items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5">
            {open ? (
              <ChevronDown size={iconSizeSm} aria-hidden="true" />
            ) : (
              <ChevronRight size={iconSizeSm} aria-hidden="true" />
            )}
            <span>Timeline</span>
          </span>
          <span>{open ? 'Hide' : 'Show'}</span>
        </span>
      </CrmButton>
      {open && (
        <div className="relative mt-3 pl-8">
          <div
            className="absolute bottom-0 left-3 top-0 w-px bg-[color:var(--crm-ui-border)]"
            aria-hidden="true"
          />
          <div className="grid gap-2.5">
            {items.map((item) => {
              const ItemIcon = timelineIconForItem(item.iconKey)
              const isSet = item.at != null
              return (
                <div key={item.key} className="relative">
                  <div
                    className={`absolute left-[-23px] top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                      isSet
                        ? 'border-[color:var(--crm-ui-border-strong)] bg-[color:var(--crm-ui-surface-strong)] text-[color:var(--crm-ui-text)]'
                        : 'border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface-strong)] text-[color:var(--crm-ui-muted-2)]'
                    }`}
                    aria-hidden="true"
                  >
                    <ItemIcon size={12} />
                  </div>
                  <div className={crmSurfaceClassName('rounded-[var(--crm-ui-radius-sm)] p-3 shadow-none')}>
                    <div className="ace-crm-mono text-xs font-extrabold text-[color:var(--crm-ui-muted)]">
                      {item.label}
                    </div>
                    <div
                      className={`mt-1 text-sm font-semibold ${
                        isSet ? 'text-[color:var(--crm-ui-text)]' : 'text-[color:var(--crm-ui-muted-2)]'
                      }`}
                    >
                      {isSet ? item.value : 'Not set'}
                    </div>
                    {item.href ? (
                      <a
                        href={item.href}
                        target={item.href.startsWith('http') ? '_blank' : undefined}
                        rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-[color:var(--crm-ui-accent-2)] underline decoration-[color:var(--crm-ui-accent-border)] underline-offset-4 hover:text-[color:var(--crm-ui-accent)]"
                      >
                        <ExternalLink size={13} aria-hidden="true" />
                        <span>{item.linkLabel ?? 'Open'}</span>
                      </a>
                    ) : null}
                    {item.key === 'estimate_date' && (
                      <input
                        key={`estimate-date-${item.estimateDateInputValue ?? ''}`}
                        aria-label="Quote date"
                        type="datetime-local"
                        defaultValue={item.estimateDateInputValue ?? ''}
                        onChange={(event) => {
                          if (!event.target.value) return
                          onEstimateDateChange(event.target.value)
                        }}
                        className={crmInputClassName('mt-2 min-h-0 px-2 py-1.5 text-xs')}
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
