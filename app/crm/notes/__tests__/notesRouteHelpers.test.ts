import { describe, expect, it } from 'vitest'
import { buildNotesCloseHref, buildNotesModuleHref } from '../_components/notesRouteHelpers'

describe('notesRouteHelpers', () => {
  it('preserves unrelated params and applies composer updates', () => {
    const href = buildNotesModuleHref('/crm/notes/tasks', new URLSearchParams('status=active&focus=task-1'), {
      composer: 'task',
      taskId: 'task-99',
    })

    expect(href).toBe('/crm/notes/tasks?status=active&focus=task-1&composer=task&taskId=task-99')
  })

  it('clears composer params without touching unrelated params', () => {
    const href = buildNotesCloseHref('/crm/notes/notes', new URLSearchParams('status=archived&composer=note&noteId=note-1&folder=folder-2'))

    expect(href).toBe('/crm/notes/notes?status=archived')
  })

  it('returns the pathname when no params remain', () => {
    const href = buildNotesCloseHref('/crm/notes', new URLSearchParams('composer=task&taskId=task-1'))

    expect(href).toBe('/crm/notes')
  })
})
