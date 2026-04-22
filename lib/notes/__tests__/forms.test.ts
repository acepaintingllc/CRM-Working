import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createEmptyTaskFormValues,
  taskFormValuesToPayload,
  taskRowToFormValues,
} from '../forms/taskForm.ts'
import {
  createEmptyNoteFormValues,
  noteFormValuesToPayload,
  noteRowToFormValues,
  withAvailableFolder,
} from '../forms/noteForm.ts'
import { isNotesFormDirty, mapNotesFormServerError } from '../forms/shared.ts'

test('createEmptyTaskFormValues returns stable defaults', () => {
  assert.deepEqual(createEmptyTaskFormValues(), {
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    allDay: false,
    reminderEnabled: false,
    reminderAtLocal: '',
    reminderOffset: '',
    priority: '',
    starred: false,
    recurrence: '',
    customInterval: '1',
    customUnit: 'week',
  })
})

test('taskRowToFormValues maps row data into the task form model', () => {
  const values = taskRowToFormValues({
    id: 'task-1',
    org_id: 'org',
    title: 'Call vendor',
    description: 'Need updated quote',
    status: 'active',
    due_at: '2026-04-21T15:30:00.000Z',
    is_all_day: false,
    has_due_time: true,
    reminder_enabled: true,
    reminder_at: '2026-04-21T14:30:00.000Z',
    reminder_offset_minutes: 60,
    reminder_sent_at: null,
    recurrence_rule: { frequency: 'custom', interval: 2, unit: 'week' },
    recurrence_series_id: null,
    priority: 'high',
    starred: true,
    source_note_id: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    completed_at: null,
    archived_at: null,
  })

  assert.equal(values.title, 'Call vendor')
  assert.equal(values.priority, 'high')
  assert.equal(values.recurrence, 'custom')
  assert.equal(values.customInterval, '2')
  assert.equal(values.customUnit, 'week')
})

test('taskFormValuesToPayload shapes recurrence, due date, and reminders', () => {
  const result = taskFormValuesToPayload({
    ...createEmptyTaskFormValues(),
    title: '  Follow up  ',
    description: '  customer note  ',
    dueDate: '2026-04-21',
    dueTime: '09:15',
    reminderEnabled: true,
    reminderAtLocal: '2026-04-21T08:00',
    reminderOffset: '30',
    priority: 'medium',
    recurrence: 'custom',
    customInterval: '3',
    customUnit: 'day',
    starred: true,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.payload.title, 'Follow up')
  assert.equal(result.payload.description, 'customer note')
  assert.equal(result.payload.priority, 'medium')
  assert.equal(result.payload.starred, true)
  assert.deepEqual(result.payload.recurrence_rule, { frequency: 'custom', interval: 3, unit: 'day' })
  assert.equal(typeof result.payload.due_at, 'string')
  assert.equal(typeof result.payload.reminder_at, 'string')
})

test('createEmptyNoteFormValues and noteRowToFormValues use the note form model', () => {
  assert.deepEqual(createEmptyNoteFormValues('folder-1'), {
    title: '',
    body: '',
    folderId: 'folder-1',
    starred: false,
  })

  assert.deepEqual(
    noteRowToFormValues({
      id: 'note-1',
      org_id: 'org',
      title: 'Title',
      body: 'Body',
      folder_id: 'folder-2',
      status: 'active',
      starred: true,
      created_by: null,
      created_at: '',
      updated_at: '',
      archived_at: null,
    }),
    {
      title: 'Title',
      body: 'Body',
      folderId: 'folder-2',
      starred: true,
    }
  )
})

test('noteFormValuesToPayload trims title and normalizes uncategorized folder', () => {
  const result = noteFormValuesToPayload({
    title: '  Idea  ',
    body: 'Draft body',
    folderId: '',
    starred: true,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.payload, {
    title: 'Idea',
    body: 'Draft body',
    folder_id: null,
    starred: true,
  })
})

test('withAvailableFolder clears missing folder selections', () => {
  assert.deepEqual(
    withAvailableFolder(
      { title: '', body: '', folderId: 'missing', starred: false },
      [{ id: 'folder-1', name: 'General', sort_order: 0, created_at: '', updated_at: '', org_id: 'org', note_count: 0 }]
    ),
    { title: '', body: '', folderId: '', starred: false }
  )
})

test('shared form helpers detect dirty state and map server errors', () => {
  assert.equal(isNotesFormDirty({ title: 'A' }, { title: 'B' }), true)
  assert.equal(isNotesFormDirty({ title: 'A' }, { title: 'A' }), false)
  assert.equal(mapNotesFormServerError({ error: 'Bad request' }, 'Fallback'), 'Bad request')
  assert.equal(mapNotesFormServerError(null, 'Fallback'), 'Fallback')
})
