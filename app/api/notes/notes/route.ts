import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { readJsonBody } from '@/lib/server/apiRoute'
import { asBoolean, asOptionalTrimmedText, asRecord, isUuid } from '@/lib/notes/server'
import { applyCursorPage, buildNoteCursor, compareNotesForList, decodeNoteCursor } from '@/lib/notes/pagination'
import type {
  NotesExplorerSections,
  NotesNoteResponse,
  NotesNoteRow,
  NotesNotesResponse,
  NotesNoteStatus,
} from '@/lib/notes/types'

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
  const search = (searchParams.get('search') ?? '').trim()
  const cursor = searchParams.get('cursor')
  const limitRaw = Number(searchParams.get('limit') ?? '24')
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.trunc(limitRaw))) : 24

  let query = supabaseAdmin
    .from('notes_notes')
    .select('*')
    .eq('org_id', session.orgId)
    .eq('status', status)

  if (folderId === 'uncategorized') {
    query = query.is('folder_id', null)
  } else if (folderId && isUuid(folderId)) {
    query = query.eq('folder_id', folderId)
  }
  if (search) {
    const escaped = search.replace(/,/g, ' ').replace(/\./g, ' ')
    query = query.or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%`)
  }

  const res = await query
  if (res.error) {
    return NextResponse.json({ error: 'Unable to load notes.' }, { status: 500 })
  }

  const notes = (res.data ?? []) as NotesNoteRow[]
  notes.sort(compareNotesForList)

  const paged = applyCursorPage({
    rows: notes,
    limit,
    cursor,
    decodeCursor: decodeNoteCursor,
    matchesCursor: (row, decoded) =>
      row.id === decoded.id &&
      row.starred === decoded.starred &&
      row.updated_at === decoded.updated_at,
    buildCursor: buildNoteCursor,
  })

  const sections: NotesExplorerSections | undefined =
    !folderId && !search
      ? {
          starred: notes.filter((note) => note.starred).slice(0, 8),
          recent: [...notes].slice(0, 8),
          loose: notes.filter((note) => note.folder_id == null && !note.starred).slice(0, 8),
        }
      : undefined

  return NextResponse.json<NotesNotesResponse>({
    notes: paged.rows,
    filters: { status, folder_id: folderId, search },
    page: paged.page,
    sections,
  })
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
