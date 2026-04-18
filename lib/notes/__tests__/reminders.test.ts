import assert from 'node:assert/strict'
import test from 'node:test'
import { partitionTasksForDashboard, shouldSendTaskReminder } from '../reminders.ts'
import type { NotesTaskRow } from '../types.ts'

function makeTask(overrides: Partial<NotesTaskRow>): NotesTaskRow {
  const now = '2026-04-07T12:00:00.000Z'
  return {
    id: '11111111-1111-4111-8111-111111111111',
    org_id: '22222222-2222-4222-8222-222222222222',
    title: 'Task',
    description: null,
    status: 'active',
    due_at: now,
    is_all_day: false,
    has_due_time: true,
    reminder_enabled: false,
    reminder_at: null,
    reminder_offset_minutes: null,
    reminder_sent_at: null,
    recurrence_rule: null,
    recurrence_series_id: null,
    priority: null,
    starred: false,
    source_note_id: null,
    created_by: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    archived_at: null,
    ...overrides,
  }
}

test('dashboard partition separates overdue, today, upcoming', () => {
  const now = new Date('2026-04-07T12:00:00.000Z')
  const result = partitionTasksForDashboard({
    now,
    timeZone: 'America/Chicago',
    upcomingDays: 3,
    tasks: [
      makeTask({ id: 'a'.padStart(36, 'a'), due_at: '2026-04-06T12:00:00.000Z' }),
      makeTask({ id: 'b'.padStart(36, 'b'), due_at: '2026-04-07T18:00:00.000Z' }),
      makeTask({ id: 'c'.padStart(36, 'c'), due_at: '2026-04-09T18:00:00.000Z' }),
    ],
  })
  assert.equal(result.overdue.length, 1)
  assert.equal(result.dueToday.length, 1)
  assert.equal(result.upcoming.length, 1)
})

test('task reminder sends only when reminder is due and unsent', () => {
  const now = new Date('2026-04-07T12:00:00.000Z')
  const sendable = makeTask({
    reminder_enabled: true,
    reminder_at: '2026-04-07T11:00:00.000Z',
    reminder_sent_at: null,
  })
  const alreadySent = makeTask({
    reminder_enabled: true,
    reminder_at: '2026-04-07T10:00:00.000Z',
    reminder_sent_at: '2026-04-07T11:00:00.000Z',
  })
  assert.equal(shouldSendTaskReminder(sendable, now), true)
  assert.equal(shouldSendTaskReminder(alreadySent, now), false)
})
