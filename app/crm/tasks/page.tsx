'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, RotateCcw, Trash2 } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import { fetchJobList } from '@/lib/jobs/client'
import type { JobSummary } from '@/types/jobs/api'
import type { JobStatus } from '@/lib/jobs/types'
import { useTasks } from '@/lib/tasks/client/useTasks'
import type { TaskDueFilter, TaskRow, TaskStatus } from '@/lib/tasks/types'

const CURRENT_TASK_JOB_STATUSES = new Set<JobStatus>([
  'estimate_scheduled',
  'estimate_sent',
  'follow_up',
  'scheduled',
])

function formatDue(value: string | null) {
  if (!value) return 'No due date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelatedJobOption(job: JobSummary) {
  const customer = job.customer_name || job.customer_address || 'No customer'
  return `${job.title} - ${customer}`
}

function linkedLabels(task: Pick<TaskRow, 'customer_id' | 'job_id' | 'estimate_id'>) {
  return [
    task.customer_id ? 'Customer linked' : null,
    task.job_id ? 'Job linked' : null,
    task.estimate_id ? 'Estimate linked' : null,
  ].filter((label): label is string => Boolean(label))
}

export default function TasksPage() {
  const {
    tasks,
    filters,
    loading,
    saving,
    error,
    setStatus,
    setDue,
    setSearch,
    createTask,
    completeTask,
    reopenTask,
    deleteTask,
  } = useTasks()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState('')

  useEffect(() => {
    let active = true

    setJobsLoading(true)
    setJobsError(null)
    fetchJobList()
      .then((rows) => {
        if (!active) return
        setJobs(rows.filter((job) => CURRENT_TASK_JOB_STATUSES.has(job.status)))
      })
      .catch((reason) => {
        if (!active) return
        setJobsError(reason instanceof Error ? reason.message : 'Unable to load current jobs.')
      })
      .finally(() => {
        if (active) setJobsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  )

  const handleSubmit = async () => {
    const ok = await createTask({
      title,
      description,
      due_at: dueAt,
      customer_id: selectedJob?.customer_id ?? '',
      job_id: selectedJob?.id ?? '',
      estimate_id: selectedJob?.linked_estimate_id ?? '',
    })
    if (ok) {
      setTitle('')
      setDescription('')
      setDueAt('')
      setSelectedJobId('')
    }
  }

  return (
    <CrmPageShell className="max-w-6xl pb-16">
      <CrmPageHeader
        eyebrow="Tasks"
        title="Tasks"
        description="Simple personal tasks and CRM follow-ups."
      />

      <div className="grid gap-4">
        <CrmSectionCard title="Add task" description="Keep it light: title, optional due date, and optional CRM links.">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
            <label className="grid gap-1.5 text-sm font-semibold text-[color:var(--crm-ui-text)]">
              Task title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={crmInputClassName()}
                placeholder="Call customer"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[color:var(--crm-ui-text)]">
              Due date
              <input
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className={crmInputClassName()}
              />
            </label>
            <div className="flex items-end">
              <CrmButton type="button" onClick={handleSubmit} disabled={saving || !title.trim()}>
                Add Task
              </CrmButton>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <label className="grid gap-1.5 text-sm font-semibold text-[color:var(--crm-ui-text)]">
              Description
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={crmInputClassName()}
                placeholder="Optional"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[color:var(--crm-ui-text)]">
              Related job
              <select
                value={selectedJobId}
                onChange={(event) => setSelectedJobId(event.target.value)}
                className={crmInputClassName()}
                disabled={jobsLoading}
              >
                <option value="">{jobsLoading ? 'Loading current jobs...' : 'No related job'}</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {formatRelatedJobOption(job)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {jobsError && (
            <p className="mt-2 text-sm font-semibold text-[color:var(--crm-ui-danger-text)]">
              {jobsError}
            </p>
          )}
        </CrmSectionCard>

        <CrmSectionCard
          title="Task list"
          badge={<CrmChip>{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</CrmChip>}
        >
          <div className="grid gap-3 lg:grid-cols-[auto_auto_minmax(0,1fr)]">
            <div className="ace-crm-surface-muted inline-flex rounded-2xl p-1">
              {(['open', 'done', 'all'] as Array<TaskStatus | 'all'>).map((value) => (
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
                  {value === 'done' ? 'Done' : value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
            <select
              value={filters.due}
              onChange={(event) => setDue(event.target.value as TaskDueFilter)}
              className={crmInputClassName()}
            >
              <option value="all">All due dates</option>
              <option value="today">Today</option>
              <option value="overdue">Overdue</option>
            </select>
            <CrmSearchBar value={filters.search} onChange={setSearch} placeholder="Search tasks..." />
          </div>
        </CrmSectionCard>

        {error && <CrmNotice tone="error" title="Task action failed">{error}</CrmNotice>}
        {loading && <CrmSectionCard title="Loading tasks">Loading tasks...</CrmSectionCard>}

        {!loading && tasks.length === 0 && (
          <CrmEmptyState title="No tasks found" description="Add a task or adjust the filters." compact />
        )}

        {!loading && tasks.length > 0 && (
          <section className="grid gap-2">
            {tasks.map((task) => {
              const labels = linkedLabels(task)
              return (
                <article key={task.id} className="ace-crm-surface grid gap-3 p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <button
                      type="button"
                      aria-label={task.status === 'open' ? `Complete ${task.title}` : `Reopen ${task.title}`}
                      onClick={() => void (task.status === 'open' ? completeTask(task.id) : reopenTask(task.id))}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--crm-ui-border)] text-[color:var(--crm-ui-muted)] hover:border-[color:var(--crm-ui-accent-border)] hover:text-[color:var(--crm-ui-accent)]"
                    >
                      {task.status === 'open' ? <Check size={16} aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-extrabold text-[color:var(--crm-ui-text)]">{task.title}</h2>
                        <CrmChip className="text-xs">{task.status}</CrmChip>
                        <CrmChip className="text-xs">{formatDue(task.due_at)}</CrmChip>
                        {labels.map((label) => <CrmChip key={label} className="text-xs">{label}</CrmChip>)}
                      </div>
                      {task.description && <p className="mt-1 text-sm text-[color:var(--crm-ui-muted)]">{task.description}</p>}
                    </div>
                    <CrmButton type="button" onClick={() => void deleteTask(task.id)} className="px-3 py-2 text-xs">
                      <Trash2 size={14} aria-hidden="true" />
                      Delete
                    </CrmButton>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </CrmPageShell>
  )
}
