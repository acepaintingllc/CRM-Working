'use client'

import type { RecurrenceFrequency, RecurrenceUnit } from '@/lib/notes/types'
import { useRouter } from 'next/navigation'
import { recurrenceOptions, recurrenceUnitOptions } from '../_lib'
import { NotesOverlayShell } from './NotesOverlayShell'
import { useTaskForm } from './useTaskForm'

export type TaskComposerProps = {
  open: boolean
  taskId?: string | null
  closeHref: string
}

export function TaskComposerOverlay(props: TaskComposerProps) {
  const router = useRouter()
  const form = useTaskForm({
    open: props.open,
    taskId: props.taskId,
    onSuccess: () => {
      router.replace(props.closeHref)
      router.refresh()
    },
  })

  return (
    <NotesOverlayShell
      open={props.open}
      onClose={() => router.replace(props.closeHref)}
      title={props.taskId ? 'Edit Task' : 'New Task'}
      description="Keep the essentials close and the secondary controls out of the way."
      variant="task"
    >
      <div className="grid gap-6 px-5 py-5">
        {form.loading && <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">Loading task...</div>}
        {form.error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{form.error}</div>}
        {!form.loading && (
          <>
            <section className="grid gap-4 rounded-[24px] border border-neutral-800 bg-neutral-900/60 p-5">
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                Title
                <input
                  value={form.title}
                  onChange={(event) => form.setTitle(event.target.value)}
                  placeholder="Call supplier about paint pricing"
                  className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                Description
                <textarea
                  value={form.description}
                  onChange={(event) => form.setDescription(event.target.value)}
                  placeholder="Optional details, context, or next step."
                  className="min-h-32 rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
            </section>

            <section className="grid gap-4 rounded-[24px] border border-neutral-800 bg-neutral-900/60 p-5">
              <div className="grid gap-1">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-emerald-300/80">Schedule</h3>
                <p className="text-sm text-neutral-400">Date, time, reminders, and recurrence stay grouped together.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Due Date
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => form.setDueDate(event.target.value)}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Due Time
                  <input
                    type="time"
                    value={form.dueTime}
                    disabled={form.allDay}
                    onChange={(event) => form.setDueTime(event.target.value)}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400 disabled:opacity-50"
                  />
                </label>
              </div>
              <label className="inline-flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-200">
                <input type="checkbox" checked={form.allDay} onChange={(event) => form.setAllDay(event.target.checked)} />
                <span>All day task</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="inline-flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-200">
                  <input type="checkbox" checked={form.reminderEnabled} onChange={(event) => form.setReminderEnabled(event.target.checked)} />
                  <span>Reminder enabled</span>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Reminder Offset (min)
                  <input
                    type="number"
                    min={0}
                    value={form.reminderOffset}
                    disabled={!form.reminderEnabled}
                    onChange={(event) => form.setReminderOffset(event.target.value)}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400 disabled:opacity-50"
                  />
                </label>
              </div>
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                Reminder Time
                <input
                  type="datetime-local"
                  value={form.reminderAtLocal}
                  disabled={!form.reminderEnabled}
                  onChange={(event) => form.setReminderAtLocal(event.target.value)}
                  className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400 disabled:opacity-50"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200 sm:col-span-2">
                  Recurrence
                  <select
                    value={form.recurrence}
                    onChange={(event) => form.setRecurrence(event.target.value as RecurrenceFrequency | '')}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                  >
                    <option value="">None</option>
                    {recurrenceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Priority
                  <select
                    value={form.priority}
                    onChange={(event) => form.setPriority(event.target.value as 'low' | 'medium' | 'high' | '')}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                  >
                    <option value="">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </div>
              {form.recurrence === 'custom' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                    Every
                    <input
                      type="number"
                      min={1}
                      value={form.customInterval}
                      onChange={(event) => form.setCustomInterval(event.target.value)}
                      className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                    Unit
                    <select
                      value={form.customUnit}
                      onChange={(event) => form.setCustomUnit(event.target.value as RecurrenceUnit)}
                      className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                    >
                      {recurrenceUnitOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </section>

            <section className="grid gap-4 rounded-[24px] border border-neutral-800 bg-neutral-900/60 p-5">
              <div className="grid gap-1">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-emerald-300/80">Visibility</h3>
                <p className="text-sm text-neutral-400">Keep starred tasks surfaced without overloading the main form.</p>
              </div>
              <label className="inline-flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-200">
                <input type="checkbox" checked={form.starred} onChange={(event) => form.setStarred(event.target.checked)} />
                <span>Star this task</span>
              </label>
            </section>

            <div className="sticky bottom-0 z-10 flex flex-wrap gap-3 border-t border-neutral-800 bg-neutral-950/95 px-1 pb-1 pt-4 backdrop-blur">
              <button
                type="button"
                onClick={form.handleSave}
                disabled={form.saving}
                className="inline-flex min-w-32 items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-neutral-950 transition hover:bg-emerald-300 disabled:opacity-60"
              >
                {form.saving ? 'Saving...' : props.taskId ? 'Save Task' : 'Create Task'}
              </button>
              <button
                type="button"
                onClick={() => router.replace(props.closeHref)}
                className="inline-flex min-w-24 items-center justify-center rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-bold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </NotesOverlayShell>
  )
}
