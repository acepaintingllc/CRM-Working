import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { asBoolean, asOptionalTrimmedText, asRecord, isUuid } from '@/lib/notes/server'
import type { NotesNoteRow } from '@/lib/notes/types'

type Params = { id: string } | Promise<{ id: string }>

export async function GET(_: Request, context: { params: Params }) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const id = params?.id
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid note id.' }, { status: 400 })
  }

  const note = await supabaseAdmin
    .from('notes_notes')
    .select('*')
    .eq('org_id', session.orgId)
    .eq('id', id)
    .maybeSingle()

  if (note.error) {
    return NextResponse.json({ error: 'Unable to load note.' }, { status: 500 })
  }
  if (!note.data) {
    return NextResponse.json({ error: 'Note not found.' }, { status: 404 })
  }

  return NextResponse.json({ note: note.data as NotesNoteRow })
}

export async function PATCH(request: Request, context: { params: Params }) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const id = params?.id
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid note id.' }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const body = asRecord(raw)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if ('title' in body) {
    const title = asOptionalTrimmedText(body.title)
    if (!title) {
      return NextResponse.json({ error: 'Note title is required.' }, { status: 400 })
    }
    patch.title = title
  }
  if ('body' in body) {
    patch.body = asOptionalTrimmedText(body.body) ?? ''
  }
  if ('starred' in body) {
    patch.starred = asBoolean(body.starred, false)
  }
  if ('folder_id' in body) {
    const folderId = asOptionalTrimmedText(body.folder_id)
    if (folderId && !isUuid(folderId)) {
      return NextResponse.json({ error: 'folder_id must be a UUID.' }, { status: 400 })
    }
    patch.folder_id = folderId
  }

  const update = await supabaseAdmin
    .from('notes_notes')
    .update(patch)
    .eq('org_id', session.orgId)
    .eq('id', id)
    .select('*')
    .single()

  if (update.error || !update.data) {
    return NextResponse.json({ error: 'Unable to update note.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, note: update.data as NotesNoteRow })
}

export async function DELETE(_: Request, context: { params: Params }) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const id = params?.id
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid note id.' }, { status: 400 })
  }

  const del = await supabaseAdmin
    .from('notes_notes')
    .delete()
    .eq('org_id', session.orgId)
    .eq('id', id)
  if (del.error) {
    return NextResponse.json({ error: 'Unable to delete note.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
