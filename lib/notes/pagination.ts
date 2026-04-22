import type { NotesCursorPage, NotesNoteRow, NotesTaskRow } from './types'

type TaskCursorShape = {
  id: string
  starred: boolean
  due_at: string | null
  created_at: string
}

type NoteCursorShape = {
  id: string
  starred: boolean
  updated_at: string
}

function encodeCursor<T>(value: T) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function decodeCursor<T>(value: string | null): T | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    return parsed as T
  } catch {
    return null
  }
}

function compareNullableAsc(left: string | null, right: string | null) {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return left.localeCompare(right)
}

function compareDesc(left: string | boolean, right: string | boolean) {
  if (left === right) return 0
  return left > right ? -1 : 1
}

export function compareTasksForList(left: NotesTaskRow, right: NotesTaskRow) {
  const starred = compareDesc(left.starred, right.starred)
  if (starred !== 0) return starred

  const due = compareNullableAsc(left.due_at, right.due_at)
  if (due !== 0) return due

  const created = compareDesc(left.created_at, right.created_at)
  if (created !== 0) return created

  return left.id.localeCompare(right.id)
}

export function compareNotesForList(left: NotesNoteRow, right: NotesNoteRow) {
  const starred = compareDesc(left.starred, right.starred)
  if (starred !== 0) return starred

  const updated = compareDesc(left.updated_at, right.updated_at)
  if (updated !== 0) return updated

  return left.id.localeCompare(right.id)
}

export function decodeTaskCursor(value: string | null) {
  return decodeCursor<TaskCursorShape>(value)
}

export function decodeNoteCursor(value: string | null) {
  return decodeCursor<NoteCursorShape>(value)
}

export function buildTaskCursor(task: NotesTaskRow) {
  return encodeCursor<TaskCursorShape>({
    id: task.id,
    starred: task.starred,
    due_at: task.due_at,
    created_at: task.created_at,
  })
}

export function buildNoteCursor(note: NotesNoteRow) {
  return encodeCursor<NoteCursorShape>({
    id: note.id,
    starred: note.starred,
    updated_at: note.updated_at,
  })
}

export function applyCursorPage<T>(params: {
  rows: T[]
  limit: number
  cursor: string | null
  decodeCursor: (value: string | null) => Record<string, unknown> | null
  matchesCursor: (row: T, cursor: Record<string, unknown>) => boolean
  buildCursor: (row: T) => string
}): { rows: T[]; page: NotesCursorPage } {
  const decodedCursor = params.decodeCursor(params.cursor)
  const startIndex =
    decodedCursor == null
      ? 0
      : Math.max(
          0,
          params.rows.findIndex((row) => params.matchesCursor(row, decodedCursor)) + 1
        )

  const pageRows = params.rows.slice(startIndex, startIndex + params.limit)
  const nextRow = params.rows[startIndex + params.limit] ?? null

  return {
    rows: pageRows,
    page: {
      limit: params.limit,
      has_more: nextRow != null,
      next_cursor: nextRow ? params.buildCursor(pageRows[pageRows.length - 1] ?? nextRow) : null,
    },
  }
}
