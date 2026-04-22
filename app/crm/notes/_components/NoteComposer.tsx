'use client'

import { FolderOpen, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { NotesOverlayShell } from './NotesOverlayShell'
import { useNoteForm } from './useNoteForm'

export type NoteComposerProps = {
  open: boolean
  noteId?: string | null
  folderId?: string | null
  closeHref: string
}

export function NoteComposerOverlay(props: NoteComposerProps) {
  const router = useRouter()
  const form = useNoteForm({
    open: props.open,
    noteId: props.noteId,
    folderId: props.folderId,
    onSuccess: (noteId) => {
      router.refresh()
      if (noteId) {
        router.push(`/crm/notes/notes/${encodeURIComponent(noteId)}`)
        return
      }
      router.replace(props.closeHref)
    },
  })

  return (
    <NotesOverlayShell
      open={props.open}
      onClose={() => router.replace(props.closeHref)}
      title={props.noteId ? 'Edit Note' : 'New Note'}
      description="Capture the idea quickly, then move into the dedicated note view when it is ready."
      variant="note"
    >
      <div className="grid gap-6 px-5 py-5">
        {form.loading && <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">Loading note composer...</div>}
        {form.error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{form.error}</div>}
        {!form.loading && (
          <>
            <section className="grid gap-4 rounded-[24px] border border-neutral-800 bg-neutral-900/60 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
              <div className="grid gap-4">
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Title
                  <input
                    value={form.title}
                    onChange={(event) => form.setTitle(event.target.value)}
                    placeholder="CRM feature idea"
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-white outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Body
                  <textarea
                    value={form.body}
                    onChange={(event) => form.setBody(event.target.value)}
                    placeholder="Capture the detail while it is fresh."
                    className="min-h-[24rem] rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                  />
                </label>
              </div>
              <div className="grid content-start gap-4">
                <div className="grid gap-1">
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-emerald-300/80">Organize</h3>
                  <p className="text-sm text-neutral-400">Keep filing lightweight so the writing area stays primary.</p>
                </div>
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Folder
                  <select
                    value={form.folderId}
                    onChange={(event) => form.setFolderId(event.target.value)}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                  >
                    <option value="">Uncategorized</option>
                    {form.folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-neutral-200">
                    <FolderOpen size={16} aria-hidden="true" />
                    <span>{form.folderId ? form.folders.find((row) => row.id === form.folderId)?.name ?? 'Folder selected' : 'No folder selected'}</span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-400">Notes stay easy to relocate later, so this can stay optional.</p>
                </div>
                <label className="inline-flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-200">
                  <input type="checkbox" checked={form.starred} onChange={(event) => form.setStarred(event.target.checked)} />
                  <span>Star this note</span>
                  <Star size={15} className={form.starred ? 'fill-amber-400 text-amber-400' : 'text-neutral-500'} aria-hidden="true" />
                </label>
              </div>
            </section>

            <div className="sticky bottom-0 z-10 flex flex-wrap gap-3 border-t border-neutral-800 bg-neutral-950/95 px-1 pb-1 pt-4 backdrop-blur">
              <button
                type="button"
                onClick={form.handleSave}
                disabled={form.saving || Boolean(props.noteId && !form.dirty)}
                className="inline-flex min-w-32 items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-neutral-950 transition hover:bg-emerald-300 disabled:opacity-60"
              >
                {form.saving ? 'Saving...' : props.noteId ? 'Save Note' : 'Create Note'}
              </button>
              <button
                type="button"
                onClick={() => router.replace(props.closeHref)}
                className="inline-flex min-w-24 items-center justify-center rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-bold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </NotesOverlayShell>
  )
}
