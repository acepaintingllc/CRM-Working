'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Plus, Settings2 } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { buildNotesModuleHref } from './notesRouteHelpers'

export function NotesModuleHeaderActions() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const folderId = pathname?.startsWith('/crm/notes/notes/folders/')
    ? pathname.split('/').at(-1) ?? null
    : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CrmButton
        href={buildNotesModuleHref(pathname ?? '/crm/notes', searchParams, {
          composer: 'task',
          taskId: null,
        })}
        tone="primary"
      >
        <Plus size={16} aria-hidden="true" />
        <span>New Task</span>
      </CrmButton>
      <CrmButton
        href={buildNotesModuleHref(pathname ?? '/crm/notes', searchParams, {
          composer: 'note',
          noteId: null,
          folder: folderId,
        })}
      >
        <Plus size={16} aria-hidden="true" />
        <span>New Note</span>
      </CrmButton>
      <CrmButton href="/crm/notes/settings">
        <Settings2 size={16} aria-hidden="true" />
        <span>Settings</span>
      </CrmButton>
    </div>
  )
}
