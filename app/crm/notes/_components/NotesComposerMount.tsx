'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { NoteComposerOverlay } from './NoteComposer'
import { TaskComposerOverlay } from './TaskComposer'
import { buildNotesCloseHref } from './notesRouteHelpers'

export function NotesComposerMount() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const composer = searchParams.get('composer')
  const closeHref = buildNotesCloseHref(pathname ?? '/crm/notes', searchParams)

  return (
    <>
      <TaskComposerOverlay open={composer === 'task'} taskId={searchParams.get('taskId')} closeHref={closeHref} />
      <NoteComposerOverlay
        open={composer === 'note'}
        noteId={searchParams.get('noteId')}
        folderId={searchParams.get('folder')}
        closeHref={closeHref}
      />
    </>
  )
}
