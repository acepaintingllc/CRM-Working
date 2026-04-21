'use client'

import Link from 'next/link'
import {
  BriefcaseBusiness,
  CalendarClock,
  Circle,
  ExternalLink,
  NotebookPen,
} from 'lucide-react'
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
  const smallActionChipClass =
    'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70'

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
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-extrabold text-gray-900">Timeline</div>
          <div className="text-xs text-gray-500">Notes and key moments.</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <div className="mb-2 text-sm font-semibold text-gray-800">Add a note</div>
        <textarea
          value={props.noteBody}
          onChange={(event) => props.setNoteBody(event.target.value)}
          placeholder="Add a note about this customer..."
          rows={3}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-black/70 transition placeholder:text-gray-400 focus:ring-2"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={props.onAddNote}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black bg-black px-3 text-sm font-semibold text-white transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-black/80"
            disabled={props.noteSaving}
            aria-label={props.noteSaving ? 'Saving note' : 'Add note'}
          >
            <NotebookPen size={16} aria-hidden="true" />
            <span>{props.noteSaving ? 'Saving...' : 'Add note'}</span>
          </button>
        </div>
      </div>

      <div className="relative mt-4 pl-8">
        <div className="absolute bottom-0 left-3 top-0 w-px bg-gray-200" aria-hidden="true" />
        {props.timelineLoading && <div className="text-gray-500">Loading timeline...</div>}
        {!props.timelineLoading && props.timelineError && <div className="text-red-700">{props.timelineError}</div>}
        {!props.timelineLoading && !props.timelineError && props.timelineEvents.length === 0 && (
          <div className="text-gray-500">No timeline events yet.</div>
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
                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  {event.title && <div className="font-semibold text-gray-900">{event.title}</div>}
                  <div className="mt-1 text-sm whitespace-pre-wrap text-gray-700">{event.body}</div>
                  {event.link_path && (
                    <div className="mt-2">
                      {event.link_path.startsWith('/api/') || event.link_path.startsWith('http') ? (
                        <a
                          href={event.link_path}
                          target="_blank"
                          rel="noreferrer"
                          className={smallActionChipClass}
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                          <span>{event.link_label ?? 'Open'}</span>
                        </a>
                      ) : (
                        <Link href={event.link_path} className={smallActionChipClass}>
                          <ExternalLink size={14} aria-hidden="true" />
                          <span>{event.link_label ?? 'Open'}</span>
                        </Link>
                      )}
                    </div>
                  )}
                  <div className="mt-1.5 text-xs text-gray-400">
                    {event.created_at ? new Date(event.created_at).toLocaleString() : 'Unknown time'}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
