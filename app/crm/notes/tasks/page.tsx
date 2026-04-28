'use client'

import { useTaskList } from '@/lib/notes/client/useTaskList'
import { formatDue } from '@/lib/notes/time'
import { useMemo, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Check, Clock3, EllipsisVertical, Repeat, Star, PencilLine } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import { buildNotesModuleHref } from '../_components'
import { recurrenceLabel } from '../_lib'

export default function NotesTasksPage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const focusId = searchParams.get('focus')
  const {
    tasks,
    loading,
    loadingMore,
    error,
    hasMore,
    filters,
    setStatus,
    setDue,
    setPriority,
    setStarredOnly,
    setSearch,
    loadMore,
    completeTask,
    reopenTask,
    archiveTask,
    unarchiveTask,
    snoozeTask,
    deleteTask,
  } = useTaskList()

  const taskHref = (taskId: string) =>
    buildNotesModuleHref(pathname ?? '/crm/notes/tasks', searchParams, {
      composer: 'task',
      taskId,
    })

  const taskCountLabel = useMemo(() => `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`, [tasks.length])

  return (
    <div className="grid gap-4">
      <CrmSectionCard
        eyebrow="Tasks"
        title="Compact task manager"
        description="Filter quickly, act inline, and open editing in the dedicated task composer."
        badge={<CrmChip>{taskCountLabel}</CrmChip>}
      >
        <div className="grid gap-3 xl:grid-cols-[auto_auto_auto_auto_minmax(0,1fr)]">
          <div className="ace-crm-surface-muted inline-flex rounded-2xl p-1">
            {(['active', 'completed', 'archived'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`rounded-xl px-3 py-2 text-sm font-extrabold transition ${
                  filters.status === value
                    ? 'bg-[color:var(--crm-ui-accent)] text-black'
                    : 'text-[color:var(--crm-ui-muted)] hover:text-[color:var(--crm-ui-text)]'
                }`}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>

          <select
            value={filters.status === 'active' ? filters.due : 'all'}
            disabled={filters.status !== 'active'}
            onChange={(event) => setDue(event.target.value as 'all' | 'overdue' | 'today' | 'upcoming')}
            className={crmInputClassName('disabled:opacity-50')}
          >
            <option value="all">All due states</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="upcoming">Upcoming</option>
          </select>

          <select
            value={filters.priority}
            onChange={(event) => setPriority(event.target.value as 'all' | 'low' | 'medium' | 'high')}
            className={crmInputClassName()}
          >
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <label className="ace-crm-surface-muted inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[color:var(--crm-ui-text)]">
            <input type="checkbox" checked={filters.starredOnly} onChange={(event) => setStarredOnly(event.target.checked)} />
            <span>Starred only</span>
          </label>

          <CrmSearchBar
            value={filters.search}
            onChange={setSearch}
            placeholder="Search tasks..."
          />
        </div>
      </CrmSectionCard>

      {loading && <CrmSectionCard title="Loading tasks">Loading tasks...</CrmSectionCard>}
      {error && (
        <CrmNotice tone="error" title="Unable to load tasks">
          {error}
        </CrmNotice>
      )}

      {!loading && (
        <section className="grid gap-2">
          {tasks.length === 0 && (
            <CrmEmptyState
              title="No tasks found"
              description="No tasks match the current filters."
              compact
            />
          )}
          {tasks.map((task) => {
            const isFocused = focusId === task.id
            return (
              <article
                key={task.id}
                className={`grid gap-3 rounded-2xl border p-4 shadow-sm transition ${
                  isFocused
                    ? 'border-[color:var(--crm-ui-accent-border)] bg-[color:var(--crm-ui-accent-soft)] ring-1 ring-[color:var(--crm-ui-accent-border)]'
                    : 'ace-crm-surface hover:border-[color:var(--crm-ui-accent-border)]'
                }`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <button
                    type="button"
                    aria-label={task.status === 'active' ? `Complete ${task.title}` : `Reopen ${task.title}`}
                    onClick={() => void (task.status === 'active' ? completeTask(task.id) : reopenTask(task.id))}
                    className={`mt-0.5 inline-flex size-9 items-center justify-center rounded-full border ${
                      task.status === 'completed'
                        ? 'border-[color:var(--crm-ui-accent-border)] bg-[color:var(--crm-ui-accent)] text-black'
                        : 'border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface-muted)] text-[color:var(--crm-ui-muted)] hover:border-[color:var(--crm-ui-accent-border)] hover:text-[color:var(--crm-ui-accent)]'
                    }`}
                  >
                    <Check size={16} aria-hidden="true" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-[color:var(--crm-ui-text)]">{task.title}</h3>
                      {task.starred && <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden="true" />}
                      <TaskPill>{task.priority ?? 'none'} priority</TaskPill>
                      {task.recurrence_rule && (
                        <TaskPill icon={<Repeat size={13} aria-hidden="true" />}>{recurrenceLabel(task.recurrence_rule)}</TaskPill>
                      )}
                    </div>
                    {task.description && <p className="mt-1 line-clamp-2 text-sm text-[color:var(--crm-ui-muted)]">{task.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--crm-ui-muted)]">
                      <TaskPill icon={<Clock3 size={13} aria-hidden="true" />}>
                        {formatDue(task.due_at, task.is_all_day, task.has_due_time)}
                      </TaskPill>
                      <TaskPill>{task.status}</TaskPill>
                    </div>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <CrmButton
                      href={taskHref(task.id)}
                      className="px-3 py-2 text-xs"
                    >
                      <PencilLine size={14} aria-hidden="true" />
                      <span>Edit</span>
                    </CrmButton>
                    {task.status === 'active' && (
                      <>
                        <CrmButton
                          type="button"
                          onClick={() => void snoozeTask(task.id, 'tomorrow')}
                          className="px-3 py-2 text-xs"
                        >
                          Snooze
                        </CrmButton>
                        <CrmButton
                          type="button"
                          onClick={() => void archiveTask(task.id)}
                          className="px-3 py-2 text-xs"
                        >
                          Archive
                        </CrmButton>
                      </>
                    )}
                    <details className="relative">
                      <summary className="ace-crm-btn ace-crm-btn-secondary flex size-9 cursor-pointer list-none items-center justify-center p-0 [&::-webkit-details-marker]:hidden">
                        <EllipsisVertical size={15} aria-hidden="true" />
                      </summary>
                      <div className="ace-crm-surface absolute right-0 top-11 z-20 min-w-40 p-1 shadow-xl">
                        {task.status === 'active' && (
                          <>
                            <MenuAction onClick={() => void completeTask(task.id)}>Complete</MenuAction>
                            <MenuAction onClick={() => void snoozeTask(task.id, 'later_today')}>Snooze later today</MenuAction>
                            <MenuAction onClick={() => void snoozeTask(task.id, 'next_week')}>Snooze next week</MenuAction>
                          </>
                        )}
                        {task.status === 'completed' && (
                          <MenuAction onClick={() => void reopenTask(task.id)}>Reopen</MenuAction>
                        )}
                        {task.status === 'archived' && (
                          <MenuAction onClick={() => void unarchiveTask(task.id)}>Unarchive</MenuAction>
                        )}
                        <MenuAction onClick={() => void deleteTask(task.id)} danger>
                          Delete
                        </MenuAction>
                      </div>
                    </details>
                  </div>
                </div>
              </article>
            )
          })}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <CrmButton
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More Tasks'}
              </CrmButton>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function TaskPill(props: { children: ReactNode; icon?: ReactNode }) {
  return (
    <CrmChip className="text-xs">
      {props.icon}
      <span>{props.children}</span>
    </CrmChip>
  )
}

function MenuAction(props: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
        props.danger
          ? 'text-[color:var(--crm-ui-danger-text)] hover:bg-[color:var(--crm-ui-danger-bg)]'
          : 'text-[color:var(--crm-ui-text)] hover:bg-[color:var(--crm-ui-surface-muted)]'
      }`}
    >
      {props.children}
    </button>
  )
}
