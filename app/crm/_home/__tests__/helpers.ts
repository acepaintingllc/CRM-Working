import {
  createCrmHomeSourceState,
  createResolvedCrmHomeLoadState,
} from '@/lib/crm/home/state'
import type {
  CalendarEvent,
  CrmHomeLoadState,
  CrmHomeSourceState,
  TaskReminderSignal,
} from '@/lib/crm/home/types'

type SourceOverrides = Partial<Record<keyof CrmHomeLoadState['sources'], CrmHomeSourceState>>

export function createHomeSourceStateMap(
  overrides?: SourceOverrides,
  loadedAt = '2026-04-21T12:00:00.000Z'
) {
  return {
    jobs: createCrmHomeSourceState('ready', 'available', null, loadedAt),
    customers: createCrmHomeSourceState('ready', 'available', null, loadedAt),
    calendarStatus: createCrmHomeSourceState('ready', 'available', null, loadedAt),
    calendarEvents: createCrmHomeSourceState('ready', 'available', null, loadedAt),
    tasks: createCrmHomeSourceState('ready', 'available', null, loadedAt),
    ...(overrides ?? {}),
  }
}

export function createHomeResolvedState(options?: {
  sourceOverrides?: SourceOverrides
  jobs?: Array<{
    id: string
    status: string | null
    title: string | null
    customer_name: string | null
    customer_address: string | null
    estimate_total_amount: number | string | null
    scheduled_date?: string | null
    scheduled_end_date?: string | null
    completed_at?: string | null
  }>
  customers?: Array<{
    id: string
    name: string | null
    email: string | null
    phone: string | null
    address: string | null
  }>
  calendarConnected?: boolean | null
  calendarTodayEvents?: CalendarEvent[]
  taskReminders?: TaskReminderSignal[]
  loadedAt?: string
}) {
  const loadedAt = options?.loadedAt ?? '2026-04-21T12:00:00.000Z'

  return createResolvedCrmHomeLoadState({
    now: new Date(loadedAt),
    jobs:
      options?.jobs ??
      [
        {
          id: 'job-1',
          status: 'estimate_sent',
          title: 'Kitchen repaint',
          customer_name: 'Alice Jones',
          customer_address: '123 Main St',
          estimate_total_amount: 1200,
        },
      ],
    customers:
      options?.customers ??
      [
        {
          id: 'customer-1',
          name: 'Alice Jones',
          email: 'alice@example.com',
          phone: '555-1111',
          address: '123 Main St',
        },
      ],
    calendarConnected: options?.calendarConnected ?? true,
    calendarTodayEvents: options?.calendarTodayEvents ?? [],
    taskReminders: options?.taskReminders ?? [],
    sources: createHomeSourceStateMap(options?.sourceOverrides, loadedAt),
  })
}
