'use client'

import { useNotesDashboard } from '@/lib/notes/client/useNotesDashboard'
import { formatDue } from '@/lib/notes/time'
import type { NotesNoteRow, NotesTaskRow } from '@/lib/notes/types'
import Link from 'next/link'
import { type ReactNode } from 'react'
import { AlertTriangle, ArrowUpRight, Clock3, Star } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'

export default function NotesTodayPage() {
  const { data, loading, error } = useNotesDashboard()

  return (
    <div className="grid gap-4">
      <CrmSectionCard
        eyebrow="Today"
        title="Daily dashboard"
        description="Overdue tasks, today's commitments, and the notes that should stay visible."
        actions={<CrmButton href="/crm/notes/settings">Reminder Settings</CrmButton>}
      >
        <div className="sr-only">Notes daily dashboard</div>
      </CrmSectionCard>

      {loading && <CrmSectionCard title="Loading dashboard">Loading dashboard...</CrmSectionCard>}
      {error && (
        <CrmNotice tone="error" title="Unable to load notes dashboard">
          {error}
        </CrmNotice>
      )}

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
    <CrmSectionCard
      title={props.title}
      badge={props.icon ? <span className="text-[color:var(--crm-ui-muted)]">{props.icon}</span> : null}
    >
      {props.tasks.length === 0 ? (
        <CrmEmptyState title={props.empty} description="Nothing needs attention in this bucket right now." compact />
      ) : (
        <div className="grid gap-2">
          {props.tasks.map((task) => (
            <Link
              key={task.id}
              href={`/crm/notes/tasks?focus=${encodeURIComponent(task.id)}`}
              className="ace-crm-surface-muted block px-4 py-4 no-underline transition hover:border-[color:var(--crm-ui-accent-border)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[color:var(--crm-ui-text)]">{task.title}</div>
                  {task.description && <div className="line-clamp-2 text-sm text-[color:var(--crm-ui-muted)]">{task.description}</div>}
                </div>
                <div className="shrink-0 text-right text-xs text-[color:var(--crm-ui-muted)]">
                  {formatDue(task.due_at, task.is_all_day, task.has_due_time)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </CrmSectionCard>
  )
}

function NotesSection(props: {
  title: string
  notes: NotesNoteRow[]
  empty: string
  icon?: ReactNode
}) {
  return (
    <CrmSectionCard
      title={props.title}
      badge={props.icon ? <span className="text-[color:var(--crm-ui-muted)]">{props.icon}</span> : null}
      actions={<CrmButton href="/crm/notes/notes" className="px-2.5 py-1.5 text-xs">Open Notes</CrmButton>}
    >
      {props.notes.length === 0 ? (
        <CrmEmptyState title={props.empty} description="Create or pin notes to keep them visible here." compact />
      ) : (
        <div className="grid gap-2">
          {props.notes.map((note) => (
            <Link
              key={note.id}
              href={`/crm/notes/notes/${encodeURIComponent(note.id)}`}
              className="ace-crm-surface-muted block px-4 py-4 no-underline transition hover:border-[color:var(--crm-ui-accent-border)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[color:var(--crm-ui-text)]">{note.title}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-[color:var(--crm-ui-muted)]">{note.body || 'No content yet.'}</div>
                </div>
                <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-[color:var(--crm-ui-muted)]" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </CrmSectionCard>
  )
}
