import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { asOptionalTrimmedText, asRecord } from '@/lib/notes/server'
import type { NotesFolderRow } from '@/lib/notes/types'

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const [foldersRes, countsRes] = await Promise.all([
    supabaseAdmin
      .from('notes_folders')
      .select('*')
      .eq('org_id', session.orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('notes_notes').select('folder_id').eq('org_id', session.orgId).eq('status', 'active'),
  ])

  if (foldersRes.error) {
    return NextResponse.json({ error: 'Unable to load folders.' }, { status: 500 })
  }
  if (countsRes.error) {
    return NextResponse.json({ error: 'Unable to load folder note counts.' }, { status: 500 })
  }

  const countMap = new Map<string, number>()
  for (const row of countsRes.data ?? []) {
    const folderId = row.folder_id
    if (!folderId || typeof folderId !== 'string') continue
    countMap.set(folderId, (countMap.get(folderId) ?? 0) + 1)
  }

  const folders = ((foldersRes.data ?? []) as NotesFolderRow[]).map((folder) => ({
    ...folder,
    note_count: countMap.get(folder.id) ?? 0,
  }))
  return NextResponse.json({ folders })
}

export async function POST(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const raw = await request.json().catch(() => null)
  const body = asRecord(raw)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const name = asOptionalTrimmedText(body.name)
  if (!name) {
    return NextResponse.json({ error: 'Folder name is required.' }, { status: 400 })
  }

  const maxOrderRes = await supabaseAdmin
    .from('notes_folders')
    .select('sort_order')
    .eq('org_id', session.orgId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxOrderRes.error) {
    return NextResponse.json({ error: 'Unable to create folder.' }, { status: 500 })
  }
  const sortOrder = typeof maxOrderRes.data?.sort_order === 'number' ? maxOrderRes.data.sort_order + 1 : 0

  const insert = await supabaseAdmin
    .from('notes_folders')
    .insert({
      org_id: session.orgId,
      name,
      sort_order: sortOrder,
    })
    .select('*')
    .single()

  if (insert.error || !insert.data) {
    const message = insert.error?.message?.toLowerCase()?.includes('duplicate')
      ? 'Folder name already exists.'
      : 'Unable to create folder.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, folder: insert.data as NotesFolderRow })
}
