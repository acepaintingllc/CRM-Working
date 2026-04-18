import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { readJsonBody } from '@/lib/server/apiRoute'
import { asRecord, isUuid } from '@/lib/notes/server'

export async function POST(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 16 * 1024 })
  if (!parsed.ok) return parsed.response
  const body = asRecord(parsed.value)
  if (!body || !Array.isArray(body.folder_ids)) {
    return NextResponse.json({ error: 'folder_ids array is required.' }, { status: 400 })
  }
  const folderIds = body.folder_ids.filter((id): id is string => typeof id === 'string')
  if (folderIds.length === 0 || folderIds.some((id) => !isUuid(id))) {
    return NextResponse.json({ error: 'folder_ids must be UUID strings.' }, { status: 400 })
  }

  const existing = await supabaseAdmin
    .from('notes_folders')
    .select('id')
    .eq('org_id', session.orgId)
    .in('id', folderIds)

  if (existing.error) {
    return NextResponse.json({ error: 'Unable to validate folders.' }, { status: 500 })
  }
  if ((existing.data ?? []).length !== folderIds.length) {
    return NextResponse.json({ error: 'One or more folders were not found.' }, { status: 404 })
  }

  for (let i = 0; i < folderIds.length; i += 1) {
    const update = await supabaseAdmin
      .from('notes_folders')
      .update({ sort_order: i })
      .eq('org_id', session.orgId)
      .eq('id', folderIds[i])
    if (update.error) {
      return NextResponse.json({ error: 'Unable to reorder folders.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
