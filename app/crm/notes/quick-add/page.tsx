import { redirect } from 'next/navigation'

export default async function NotesQuickAddRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode
  const folder = Array.isArray(params.folder) ? params.folder[0] : params.folder

  if (mode === 'note') {
    const query = new URLSearchParams({ composer: 'note' })
    if (folder) query.set('folder', folder)
    redirect(`/crm/notes/notes?${query.toString()}`)
  }

  redirect('/crm/notes/tasks?composer=task')
}
