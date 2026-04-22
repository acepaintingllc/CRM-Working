'use client'

import Link from 'next/link'
import {
  BriefcaseBusiness,
  CalendarClock,
  Circle,
  ExternalLink,
  NotebookPen,
} from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { CustomerTimelineEvent } from '@/lib/customers/types'

type CustomerTimelinePanelProps = {
  timelineEvents: CustomerTimelineEvent[]
  timelineLoading: boolean
  timelineError: string | null
  noteBody: string
  noteSaving: boolean
  setNoteBody: (value: string) => void
  onAddNote: () => void
}

export function CustomerTimelinePanel(props: CustomerTimelinePanelProps) {
  function timelineVisual(event: CustomerTimelineEvent) {
    const combined = `${event.type} ${event.title ?? ''} ${event.link_label ?? ''}`.toLowerCase()
    if (combined.includes('note')) {
      return { icon: NotebookPen, nodeClass: 'bg-white text-gray-700 border-gray-300' }
    }
    if (combined.includes('estimate') && combined.includes('sched')) {
      return { icon: CalendarClock, nodeClass: 'bg-white text-gray-700 border-gray-300' }
    }
    if (combined.includes('job')) {
      return { icon: BriefcaseBusiness, nodeClass: 'bg-white text-gray-700 border-gray-300' }
    }
    return { icon: Circle, nodeClass: 'bg-white text-gray-500 border-gray-300' }
  }

  return (
    <CrmSectionCard title="Timeline" description="Notes and key moments.">

      <div className="ace-crm-surface-muted rounded-[var(--crm-ui-radius-sm)] p-3">
        <div className="mb-2 text-sm font-semibold text-[color:var(--crm-ui-text)]">Add a note</div>
        <textarea
          value={props.noteBody}
          onChange={(event) => props.setNoteBody(event.target.value)}
          placeholder="Add a note about this customer..."
          rows={3}
          className="ace-crm-input text-sm"
        />
        <div className="mt-2 flex justify-end">
          <CrmButton type="button" onClick={props.onAddNote} disabled={props.noteSaving} tone="primary">
            <NotebookPen size={16} aria-hidden="true" />
            <span>{props.noteSaving ? 'Saving...' : 'Add note'}</span>
          </CrmButton>
        </div>
      </div>

      <div className="relative mt-4 pl-8">
        <div className="absolute bottom-0 left-3 top-0 w-px bg-gray-200" aria-hidden="true" />
        {props.timelineLoading && <div className="text-[color:var(--crm-ui-muted)]">Loading timeline...</div>}
        {!props.timelineLoading && props.timelineError && <div className="text-[color:var(--crm-ui-danger-text)]">{props.timelineError}</div>}
        {!props.timelineLoading && !props.timelineError && props.timelineEvents.length === 0 && (
          <CrmEmptyState compact emoji="📝" title="No timeline events yet" description="Add a note or create related CRM activity to build the customer timeline." />
        )}
        {!props.timelineLoading &&
          !props.timelineError &&
          props.timelineEvents.map((event) => {
            const visual = timelineVisual(event)
            const EventIcon = visual.icon
            return (
              <div key={event.id} className="relative mb-3 last:mb-0">
                <div
                  className={`absolute left-[-23px] top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border ${visual.nodeClass}`}
                  aria-hidden="true"
                >
                  <EventIcon size={12} />
                </div>
                <div className="ace-crm-surface rounded-[var(--crm-ui-radius-sm)] p-3">
                  {event.title && <div className="font-semibold text-[color:var(--crm-ui-text)]">{event.title}</div>}
                  <div className="mt-1 text-sm whitespace-pre-wrap text-[color:var(--crm-ui-text)]">{event.body}</div>
                  {event.link_path && (
                    <div className="mt-2">
                      {event.link_path.startsWith('/api/') || event.link_path.startsWith('http') ? (
                        <CrmButton
                          href={event.link_path}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                          <span>{event.link_label ?? 'Open'}</span>
                        </CrmButton>
                      ) : (
                        <CrmButton href={event.link_path}>
                          <ExternalLink size={14} aria-hidden="true" />
                          <span>{event.link_label ?? 'Open'}</span>
                        </CrmButton>
                      )}
                    </div>
                  )}
                  <div className="mt-1.5 text-xs text-[color:var(--crm-ui-muted)]">
                    {event.created_at ? new Date(event.created_at).toLocaleString() : 'Unknown time'}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </CrmSectionCard>
  )
}
