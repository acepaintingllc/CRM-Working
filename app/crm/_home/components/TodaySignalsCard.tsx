import Link from 'next/link'
import { BellRing, CalendarCheck, NotebookText } from 'lucide-react'
import { formatEventWindow } from '@/lib/crm/home/calendar'
import { formatTaskDue } from '@/lib/crm/home/formatters'
import type { CalendarEvent, NotesReminderSignal } from '@/lib/crm/home/types'

type TodaySignalsCardProps = {
  loading: boolean
  calendarConnected: boolean | null
  calendarError: string | null
  calendarTodayEvents: CalendarEvent[]
  notesReminders: NotesReminderSignal[]
}

export function TodaySignalsCard({
  loading,
  calendarConnected,
  calendarError,
  calendarTodayEvents,
  notesReminders,
}: TodaySignalsCardProps) {
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
          Calendar
        </button>
        <button className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ color: 'var(--crm-muted)' }}>
          Reminders
        </button>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="py-8 text-center text-sm"
            style={{ color: 'var(--crm-muted)' }}
          >
            Loading...
          </div>
        ) : calendarError ? (
          <div className="py-4 text-sm" style={{ color: 'var(--crm-danger-text)' }}>
            {calendarError}
          </div>
        ) : calendarConnected === false ? (
          <div className="grid gap-2 py-4">
            <div className="text-sm" style={{ color: 'var(--crm-muted)' }}>
              Google Calendar is not connected.
            </div>
            <Link
              href="/crm/calendar"
              className="inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold"
              style={{ background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }}
            >
              Connect Google
            </Link>
          </div>
        ) : calendarTodayEvents.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--crm-muted)' }}>
            No calendar items today.
          </div>
        ) : (
          <div className="grid gap-0">
            {calendarTodayEvents.map((event, index) => (
              <div
                key={`${event.calendarId}:${event.id}`}
                className="py-3"
                style={{
                  borderBottom: index < calendarTodayEvents.length - 1 ? `1px solid var(--crm-border)` : 'none',
                }}
              >
                <div className="text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>
                  {event.summary ?? '(No title)'}
                </div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--crm-muted)' }}>
                  {formatEventWindow(event.start, event.end)}
                </div>
                {event.htmlLink && (
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex text-xs font-semibold underline-offset-2 hover:underline"
                    style={{ color: 'var(--crm-muted)' }}
                  >
                    Open event
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && notesReminders.length > 0 && (
          <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--crm-border)' }}>
            <div
              className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest"
              style={{ color: 'var(--crm-muted)' }}
            >
              <BellRing size={12} aria-hidden="true" />
              Reminders
              <span
                className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold"
                style={{ background: 'var(--crm-border)', color: 'var(--crm-muted)' }}
              >
                {notesReminders.length}
              </span>
            </div>
            <div className="grid gap-2">
              {notesReminders.slice(0, 4).map((signal) => (
                <Link
                  key={`${signal.kind}:${signal.task.id}`}
                  href={`/crm/notes/tasks?focus=${encodeURIComponent(signal.task.id)}`}
                  className="flex items-start gap-2 rounded-lg border p-2.5 transition"
                  style={{
                    borderColor:
                      signal.kind === 'overdue' ? 'var(--crm-danger-border)' : 'var(--crm-border)',
                    background: signal.kind === 'overdue' ? 'var(--crm-danger-bg)' : 'transparent',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold" style={{ color: 'var(--crm-text)' }}>
                      {signal.task.title}
                    </div>
                    <div
                      className="text-xs"
                      style={{
                        color:
                          signal.kind === 'overdue' ? 'var(--crm-danger-text)' : 'var(--crm-muted)',
                      }}
                    >
                      {signal.kind === 'overdue' ? 'Overdue' : 'Due today'} {'\u2022'}{' '}
                      {formatTaskDue(
                        signal.task.due_at,
                        signal.task.is_all_day,
                        signal.task.has_due_time
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--crm-border)' }}>
        <Link
          href="/crm/calendar"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
          style={{
            borderColor: 'var(--crm-border)',
            background: 'var(--crm-button)',
            color: 'var(--crm-button-text)',
          }}
        >
          <CalendarCheck size={13} aria-hidden="true" />
          Calendar
        </Link>
        <Link
          href="/crm/notes"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
          style={{
            borderColor: 'var(--crm-border)',
            background: 'var(--crm-button)',
            color: 'var(--crm-button-text)',
          }}
        >
          <NotebookText size={13} aria-hidden="true" />
          Notes
        </Link>
      </div>
    </div>
  )
}
