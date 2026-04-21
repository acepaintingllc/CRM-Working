export function formatCurrency(value: number | string | null | undefined) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numeric)
}

export function formatStatus(status: string | null | undefined) {
  const map: Record<string, string> = {
    estimate_sent: 'Estimate Sent',
    estimate_scheduled: 'Scheduled',
    follow_up: 'Follow Up',
    completed: 'Won',
    lost: 'Lost',
    new: 'New',
    in_progress: 'In Progress',
  }
  if (!status) return 'Open'
  return map[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatTaskDue(iso: string | null, allDay: boolean, hasDueTime: boolean) {
  if (!iso) return 'No due date'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  if (allDay || !hasDueTime) return date.toLocaleDateString()
  return date.toLocaleString()
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function formatTodayLabel(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
