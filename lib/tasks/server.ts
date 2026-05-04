import type { TaskDueFilter, TaskRow, TaskStatus } from './types'
import { isUuid } from '../validation/uuid.ts'

export { isUuid } from '../validation/uuid.ts'

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function asTrimmedText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function asNullableTrimmedText(value: unknown) {
  const text = asTrimmedText(value)
  return text || null
}

export function asNullableUuid(value: unknown, field: string) {
  const text = asNullableTrimmedText(value)
  if (!text) return { ok: true as const, value: null }
  if (!isUuid(text)) return { ok: false as const, error: `${field} must be a UUID.` }
  return { ok: true as const, value: text }
}

export function asTaskStatus(value: unknown): TaskStatus | null {
  return value === 'open' || value === 'done' ? value : null
}

export function asTaskListStatus(value: unknown): TaskStatus | 'all' {
  return value === 'done' || value === 'all' ? value : 'open'
}

export function asDueFilter(value: unknown): TaskDueFilter {
  return value === 'today' || value === 'overdue' ? value : 'all'
}

export function asNullableIso(value: unknown) {
  const text = asNullableTrimmedText(value)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function taskMatchesDueFilter(task: Pick<TaskRow, 'due_at' | 'status'>, due: TaskDueFilter, now = new Date()) {
  if (due === 'all') return true
  if (task.status !== 'open' || !task.due_at) return false

  const dueAt = new Date(task.due_at)
  if (Number.isNaN(dueAt.getTime())) return false

  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  if (due === 'overdue') return dueAt < todayStart
  return dueAt >= todayStart && dueAt < tomorrowStart
}

export function sortTasksForList(tasks: TaskRow[]) {
  return [...tasks].sort((left, right) => {
    if (left.status !== right.status) return left.status === 'open' ? -1 : 1
    const leftDue = left.due_at ? new Date(left.due_at).getTime() : Number.MAX_SAFE_INTEGER
    const rightDue = right.due_at ? new Date(right.due_at).getTime() : Number.MAX_SAFE_INTEGER
    if (leftDue !== rightDue) return leftDue - rightDue
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
}
