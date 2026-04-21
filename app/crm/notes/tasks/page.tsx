'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, Clock3, EllipsisVertical, Repeat, Star, PencilLine } from 'lucide-react'
import { buildNotesModuleHref } from '../_components'
import { formatDue, recurrenceLabel, type TaskRow } from '../_lib'

type StatusFilter = 'active' | 'completed' | 'archived'
type DueFilter = 'all' | 'overdue' | 'today' | 'upcoming'
type PriorityFilter = 'all' | 'low' | 'medium' | 'high'

export default function NotesTasksPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const focusId = searchParams.get('focus')

  const [status, setStatus] = useState<StatusFilter>('active')
  const [due, setDue] = useState<DueFilter>('all')
  const [priority, setPriority] = useState<PriorityFilter>('all')
  const [starredOnly, setStarredOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('status', status)
    if (status === 'active') query.set('due', due)
    if (priority !== 'all') query.set('priority', priority)
    if (starredOnly) query.set('starred', 'true')
    if (search.trim()) query.set('search', search.trim())
    const res = await authedFetch(`/api/notes/tasks?${query.toString()}`, { cache: 'no-store' })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? 'Unable to load tasks.')
      setLoading(false)
      return
    }
    setTasks((payload?.tasks ?? []) as TaskRow[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, due, priority, starredOnly])

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const taskHref = (taskId: string) =>
    buildNotesModuleHref(pathname ?? '/crm/notes/tasks', searchParams, {
      composer: 'task',
      taskId,
    })

  const runAction = async (path: string, method: 'POST' | 'DELETE' = 'POST', body?: Record<string, unknown>) => {
    const res = await authedFetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? 'Action failed.')
      return
    }
    await load()
    router.refresh()
  }

  const taskCountLabel = useMemo(() => `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`, [tasks.length])

  return (
    <div className="grid gap-4">
      <section className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-300/80">Tasks</div>
            <h2 className="mt-2 text-2xl font-extrabold text-white">Compact task manager</h2>
            <p className="mt-1 text-sm text-neutral-400">Filter quickly, act inline, and open editing in the dedicated task composer.</p>
          </div>
          <div className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs font-bold text-neutral-400">
            {taskCountLabel}
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[auto_auto_auto_auto_minmax(0,1fr)]">
          <div className="inline-flex rounded-2xl bg-neutral-900 p-1">
            {(['active', 'completed', 'archived'] as StatusFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`rounded-xl px-3 py-2 text-sm font-extrabold transition ${
                  status === value ? 'bg-emerald-400 text-neutral-950' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>

          <select
            value={status === 'active' ? due : 'all'}
            disabled={status !== 'active'}
            onChange={(event) => setDue(event.target.value as DueFilter)}
            className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-emerald-400 disabled:opacity-50"
          >
            <option value="all">All due states</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="upcoming">Upcoming</option>
          </select>

          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as PriorityFilter)}
            className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-emerald-400"
          >
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <label className="inline-flex items-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-200">
            <input type="checkbox" checked={starredOnly} onChange={(event) => setStarredOnly(event.target.checked)} />
            <span>Starred only</span>
          </label>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks..."
            className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
          />
        </div>
      </section>

      {loading && <div className="text-sm text-neutral-400">Loading tasks...</div>}
      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

      {!loading && (
        <section className="grid gap-2">
          {tasks.length === 0 && (
            <div className="rounded-[28px] border border-dashed border-neutral-800 bg-neutral-950 p-6 text-sm text-neutral-500 shadow-sm">
              No tasks found for the current filters.
            </div>
          )}
          {tasks.map((task) => {
            const isFocused = focusId === task.id
            return (
              <article
                key={task.id}
                className={`grid gap-3 rounded-[26px] border p-4 shadow-sm transition ${
                  isFocused
                    ? 'border-emerald-400/60 bg-neutral-900 ring-1 ring-emerald-400/30'
                    : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                }`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <button
                    type="button"
                    aria-label={task.status === 'active' ? `Complete ${task.title}` : `Reopen ${task.title}`}
                    onClick={() =>
                      void runAction(
                        task.status === 'active'
                          ? `/api/notes/tasks/${task.id}/complete`
                          : `/api/notes/tasks/${task.id}/reopen`
                      )
                    }
                    className={`mt-0.5 inline-flex size-9 items-center justify-center rounded-full border ${
                      task.status === 'completed'
                        ? 'border-emerald-400/40 bg-emerald-400 text-neutral-950'
                        : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-emerald-400 hover:text-emerald-300'
                    }`}
                  >
                    <Check size={16} aria-hidden="true" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-white">{task.title}</h3>
                      {task.starred && <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden="true" />}
                      <TaskPill>{task.priority ?? 'none'} priority</TaskPill>
                      {task.recurrence_rule && (
                        <TaskPill icon={<Repeat size={13} aria-hidden="true" />}>{recurrenceLabel(task.recurrence_rule)}</TaskPill>
                      )}
                    </div>
                    {task.description && <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{task.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
                      <TaskPill icon={<Clock3 size={13} aria-hidden="true" />}>
                        {formatDue(task.due_at, task.is_all_day, task.has_due_time)}
                      </TaskPill>
                      <TaskPill>{task.status}</TaskPill>
                    </div>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <Link
                      href={taskHref(task.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-bold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
                    >
                      <PencilLine size={14} aria-hidden="true" />
                      <span>Edit</span>
                    </Link>
                    {task.status === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void runAction(`/api/notes/tasks/${task.id}/snooze`, 'POST', { action: 'tomorrow' })}
                          className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-bold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
                        >
                          Snooze
                        </button>
                        <button
                          type="button"
                          onClick={() => void runAction(`/api/notes/tasks/${task.id}/archive`)}
                          className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-bold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
                        >
                          Archive
                        </button>
                      </>
                    )}
                    <details className="relative">
                      <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900 text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800 [&::-webkit-details-marker]:hidden">
                        <EllipsisVertical size={15} aria-hidden="true" />
                      </summary>
                      <div className="absolute right-0 top-11 z-20 min-w-40 rounded-2xl border border-neutral-800 bg-neutral-950 p-1 shadow-xl">
                        {task.status === 'active' && (
                          <>
                            <MenuAction onClick={() => void runAction(`/api/notes/tasks/${task.id}/complete`)}>
                              Complete
                            </MenuAction>
                            <MenuAction onClick={() => void runAction(`/api/notes/tasks/${task.id}/snooze`, 'POST', { action: 'later_today' })}>
                              Snooze later today
                            </MenuAction>
                            <MenuAction onClick={() => void runAction(`/api/notes/tasks/${task.id}/snooze`, 'POST', { action: 'next_week' })}>
                              Snooze next week
                            </MenuAction>
                          </>
                        )}
                        {task.status === 'completed' && (
                          <MenuAction onClick={() => void runAction(`/api/notes/tasks/${task.id}/reopen`)}>
                            Reopen
                          </MenuAction>
                        )}
                        {task.status === 'archived' && (
                          <MenuAction onClick={() => void runAction(`/api/notes/tasks/${task.id}/unarchive`)}>
                            Unarchive
                          </MenuAction>
                        )}
                        <MenuAction onClick={() => void runAction(`/api/notes/tasks/${task.id}`, 'DELETE')} danger>
                          Delete
                        </MenuAction>
                      </div>
                    </details>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}

function TaskPill(props: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-400">
      {props.icon}
      <span>{props.children}</span>
    </span>
  )
}

function MenuAction(props: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
        props.danger ? 'text-red-300 hover:bg-red-500/10' : 'text-neutral-200 hover:bg-neutral-900'
      }`}
    >
      {props.children}
    </button>
  )
}
