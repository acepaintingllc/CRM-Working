import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { readJsonBody } from '@/lib/server/apiRoute'
import { asBoolean, asOptionalTrimmedText, asRecord, isUuid } from '@/lib/notes/server'
import type { NotesNoteResponse, NotesNoteRow, NotesNotesResponse, NotesNoteStatus } from '@/lib/notes/types'

function asNoteStatus(value: string | null): NotesNoteStatus | null {
  if (value === 'active' || value === 'archived') return value
  return null
}

export async function GET(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { searchParams } = new URL(request.url)
  const status = asNoteStatus(searchParams.get('status')) ?? 'active'
  const folderId = searchParams.get('folder_id')
  const search = (searchParams.get('search') ?? '').trim().toLowerCase()

  let query = supabaseAdmin
    .from('notes_notes')
    .select('*')
    .eq('org_id', session.orgId)
    .eq('status', status)
    .order('starred', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(500)

  if (folderId === 'uncategorized') {
    query = query.is('folder_id', null)
  } else if (folderId && isUuid(folderId)) {
    query = query.eq('folder_id', folderId)
  }

  const res = await query
  if (res.error) {
    return NextResponse.json({ error: 'Unable to load notes.' }, { status: 500 })
  }

  let notes = (res.data ?? []) as NotesNoteRow[]
  if (search) {
    notes = notes.filter((note) => {
      const haystack = `${note.title} ${note.body}`.toLowerCase()
      return haystack.includes(search)
    })
  }

  return NextResponse.json<NotesNotesResponse>({ notes, filters: { status, folder_id: folderId, search } })
}

export async function POST(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 128 * 1024 })
  if (!parsed.ok) return parsed.response
  const body = asRecord(parsed.value)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const title = asOptionalTrimmedText(body.title)
  if (!title) {
    return NextResponse.json({ error: 'Note title is required.' }, { status: 400 })
  }
  const folderId = asOptionalTrimmedText(body.folder_id)
  if (folderId && !isUuid(folderId)) {
    return NextResponse.json({ error: 'folder_id must be a UUID.' }, { status: 400 })
  }

  const payload = {
    org_id: session.orgId,
    title,
    body: asOptionalTrimmedText(body.body) ?? '',
    folder_id: folderId,
    status: 'active',
    starred: asBoolean(body.starred, false),
    created_by: session.userId,
  }

  const insert = await supabaseAdmin.from('notes_notes').insert(payload).select('*').single()
  if (insert.error || !insert.data) {
    return NextResponse.json({ error: 'Unable to create note.' }, { status: 500 })
  }
  return NextResponse.json<NotesNoteResponse>({ ok: true, note: insert.data as NotesNoteRow })
}
