'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Plus, Settings2 } from 'lucide-react'
import { buildNotesModuleHref } from './notesRouteHelpers'

export function NotesModuleHeaderActions() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const folderId = pathname?.startsWith('/crm/notes/notes/folders/')
    ? pathname.split('/').at(-1) ?? null
    : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={buildNotesModuleHref(pathname ?? '/crm/notes', searchParams, {
          composer: 'task',
          taskId: null,
        })}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500 px-3 py-2 text-sm font-extrabold text-neutral-950 transition hover:bg-emerald-400"
      >
        <Plus size={16} aria-hidden="true" />
        <span>New Task</span>
      </Link>
      <Link
        href={buildNotesModuleHref(pathname ?? '/crm/notes', searchParams, {
          composer: 'note',
          noteId: null,
          folder: folderId,
        })}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-extrabold text-white transition hover:border-neutral-600 hover:bg-neutral-800"
      >
        <Plus size={16} aria-hidden="true" />
        <span>New Note</span>
      </Link>
      <Link
        href="/crm/notes/settings"
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-bold text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white"
      >
        <Settings2 size={16} aria-hidden="true" />
        <span>Settings</span>
      </Link>
    </div>
  )
}
