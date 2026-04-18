import type { NotesTaskRow } from './types.ts'
import { getTodayBoundsInTimeZone, localDateKey } from './time.ts'

function formatDueLabel(task: Pick<NotesTaskRow, 'due_at' | 'is_all_day' | 'has_due_time'>, timeZone: string) {
  if (!task.due_at) return 'No due date'
  const due = new Date(task.due_at)
  if (Number.isNaN(due.getTime())) return task.due_at
  if (task.is_all_day || !task.has_due_time) {
    return due.toLocaleDateString('en-US', { timeZone })
  }
  return due.toLocaleString('en-US', { timeZone })
}

export function partitionTasksForDashboard(params: {
  tasks: NotesTaskRow[]
  now: Date
  timeZone: string
  upcomingDays: number
}) {
  const todayBounds = getTodayBoundsInTimeZone(params.now, params.timeZone)
  const upcomingEnd = new Date(todayBounds.end.getTime())
  upcomingEnd.setUTCDate(upcomingEnd.getUTCDate() + Math.max(0, params.upcomingDays))

  const overdue: NotesTaskRow[] = []
  const dueToday: NotesTaskRow[] = []
  const upcoming: NotesTaskRow[] = []
  const untimedToday: NotesTaskRow[] = []

  for (const task of params.tasks) {
    if (task.status !== 'active' || !task.due_at) continue
    const due = new Date(task.due_at)
    if (Number.isNaN(due.getTime())) continue

    if (due < todayBounds.start) {
      overdue.push(task)
      continue
    }
    if (due >= todayBounds.start && due < todayBounds.end) {
      dueToday.push(task)
      if (task.is_all_day || !task.has_due_time) untimedToday.push(task)
      continue
    }
    if (params.upcomingDays > 0 && due < upcomingEnd) {
      upcoming.push(task)
    }
  }

  const byDue = (a: NotesTaskRow, b: NotesTaskRow) => {
    const at = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER
    const bt = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER
    return at - bt
  }

  overdue.sort(byDue)
  dueToday.sort(byDue)
  upcoming.sort(byDue)
  untimedToday.sort(byDue)

  return {
    overdue,
    dueToday,
    upcoming,
    untimedToday,
    dateKey: todayBounds.dateKey,
  }
}

export function shouldSendTaskReminder(task: NotesTaskRow, now: Date) {
  if (task.status !== 'active') return false
  if (!task.reminder_enabled || !task.reminder_at) return false
  const reminderAt = new Date(task.reminder_at)
  if (Number.isNaN(reminderAt.getTime())) return false
  if (reminderAt > now) return false

  if (!task.reminder_sent_at) return true
  const sentAt = new Date(task.reminder_sent_at)
  if (Number.isNaN(sentAt.getTime())) return true
  return sentAt < reminderAt
}

export function buildTaskReminderEmail(params: {
  crmName: string
  task: Pick<NotesTaskRow, 'title' | 'description' | 'due_at' | 'is_all_day' | 'has_due_time'>
  timeZone: string
}) {
  const subject = `[${params.crmName}] Reminder - ${params.task.title}`
  const dueLabel = formatDueLabel(params.task, params.timeZone)
  const lines = [`Task: ${params.task.title}`, `Due: ${dueLabel}`]
  if (params.task.description?.trim()) {
    lines.push('', params.task.description.trim())
  }
  return { subject, body: lines.join('\n') }
}

export function buildDailySummaryEmail(params: {
  crmName: string
  timeZone: string
  now: Date
  overdue: NotesTaskRow[]
  dueToday: NotesTaskRow[]
  untimedToday: NotesTaskRow[]
}) {
  const dateKey = localDateKey(params.now, params.timeZone)
  const subject = `[${params.crmName}] - Today's Reminders - ${dateKey}`
  const lines: string[] = []

  lines.push('Overdue')
  if (params.overdue.length === 0) {
    lines.push('- None')
  } else {
    for (const task of params.overdue) {
      lines.push(`- ${task.title} (${formatDueLabel(task, params.timeZone)})`)
    }
  }

  lines.push('', 'Due Today')
  if (params.dueToday.length === 0) {
    lines.push('- None')
  } else {
    for (const task of params.dueToday) {
      lines.push(`- ${task.title} (${formatDueLabel(task, params.timeZone)})`)
    }
  }

  if (params.untimedToday.length > 0) {
    lines.push('', 'Untimed Today')
    for (const task of params.untimedToday) {
      lines.push(`- ${task.title}`)
    }
  }

  return { subject, body: lines.join('\n') }
}

export function reminderTypeForTask(task: Pick<NotesTaskRow, 'recurrence_rule'>) {
  return task.recurrence_rule ? 'recurring_task_reminder' : 'single_task_reminder'
}

export function buildReminderIdempotencyKey(params: {
  type: 'daily_summary' | 'single_task_reminder' | 'recurring_task_reminder'
  orgId: string
  taskId?: string | null
  marker: string
}) {
  const taskPart = params.taskId ?? 'none'
  return `notes:${params.type}:${params.orgId}:${taskPart}:${params.marker}`
}
