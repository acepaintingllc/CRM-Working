'use client'

import { useNotesDashboard } from '@/lib/notes/client/useNotesDashboard'
import { formatDue } from '@/lib/notes/time'
import type { NotesNoteRow, NotesTaskRow } from '@/lib/notes/types'
import Link from 'next/link'
import { type ReactNode } from 'react'
import { AlertTriangle, ArrowUpRight, Clock3, Star } from 'lucide-react'

export default function NotesTodayPage() {
  const { data, loading, error } = useNotesDashboard()

  return (
    <div className="grid gap-4">
      <section className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-300/80">Today</div>
            <h2 className="mt-2 text-2xl font-extrabold text-white">Daily dashboard</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Overdue tasks, today&apos;s commitments, and the notes that should stay visible.
            </p>
          </div>
          <Link
            href="/crm/notes/settings"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-bold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
          >
            Reminder Settings
          </Link>
        </div>
      </section>

      {loading && <div className="text-sm text-neutral-400">Loading dashboard...</div>}
      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

      {!loading && !error && data && (
        <>
          <TaskSection
            title="Overdue"
            tasks={data.tasks.overdue}
            empty="No overdue tasks."
            icon={<AlertTriangle size={16} aria-hidden="true" />}
          />
          <TaskSection
            title="Due Today"
            tasks={data.tasks.due_today}
            empty="Nothing due today."
            icon={<Clock3 size={16} aria-hidden="true" />}
          />
          <TaskSection title="Upcoming" tasks={data.tasks.upcoming} empty="No upcoming tasks." />
          <div className="grid gap-4 xl:grid-cols-2">
            <NotesSection
              title="Pinned Notes"
              notes={data.notes.starred}
              empty="No starred notes yet."
              icon={<Star size={16} aria-hidden="true" />}
            />
            <NotesSection title="Recent Notes" notes={data.notes.recent} empty="No recent notes yet." />
          </div>
        </>
      )}
    </div>
  )
}

function TaskSection(props: {
  title: string
  tasks: NotesTaskRow[]
  empty: string
  icon?: ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
      <h3 className="mb-3 inline-flex items-center gap-2 text-base font-extrabold text-white">
        {props.icon}
        <span>{props.title}</span>
      </h3>
      {props.tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/70 p-4 text-sm text-neutral-500">{props.empty}</div>
      ) : (
        <div className="grid gap-2">
          {props.tasks.map((task) => (
            <Link
              key={task.id}
              href={`/crm/notes/tasks?focus=${encodeURIComponent(task.id)}`}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 transition hover:border-neutral-700 hover:bg-neutral-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-white">{task.title}</div>
                  {task.description && <div className="line-clamp-2 text-sm text-neutral-400">{task.description}</div>}
                </div>
                <div className="shrink-0 text-right text-xs text-neutral-500">
                  {formatDue(task.due_at, task.is_all_day, task.has_due_time)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function NotesSection(props: {
  title: string
  notes: NotesNoteRow[]
  empty: string
  icon?: ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-base font-extrabold text-white">
          {props.icon}
          <span>{props.title}</span>
        </h3>
        <Link href="/crm/notes/notes" className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300/80">
          Open Notes
        </Link>
      </div>
      {props.notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/70 p-4 text-sm text-neutral-500">{props.empty}</div>
      ) : (
        <div className="grid gap-2">
          {props.notes.map((note) => (
            <Link
              key={note.id}
              href={`/crm/notes/notes/${encodeURIComponent(note.id)}`}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 transition hover:border-neutral-700 hover:bg-neutral-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-white">{note.title}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-neutral-400">{note.body || 'No content yet.'}</div>
                </div>
                <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-neutral-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
