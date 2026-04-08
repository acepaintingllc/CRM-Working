import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { asNullableInt, asOptionalTrimmedText, asRecord, isUuid } from '@/lib/notes/server'
import type { NotesFolderRow } from '@/lib/notes/types'

type Params = { id: string } | Promise<{ id: string }>

export async function PATCH(request: Request, context: { params: Params }) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const id = params?.id
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid folder id.' }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const body = asRecord(raw)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if ('name' in body) {
    const name = asOptionalTrimmedText(body.name)
    if (!name) return NextResponse.json({ error: 'Folder name is required.' }, { status: 400 })
    patch.name = name
  }
  if ('sort_order' in body) {
    const sortOrder = asNullableInt(body.sort_order)
    if (sortOrder == null) return NextResponse.json({ error: 'sort_order must be an integer.' }, { status: 400 })
    patch.sort_order = sortOrder
  }

  const update = await supabaseAdmin
    .from('notes_folders')
    .update(patch)
    .eq('org_id', session.orgId)
    .eq('id', id)
    .select('*')
    .single()

  if (update.error || !update.data) {
    const message = update.error?.message?.toLowerCase()?.includes('duplicate')
      ? 'Folder name already exists.'
      : 'Unable to update folder.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, folder: update.data as NotesFolderRow })
}

export async function DELETE(request: Request, context: { params: Params }) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const id = params?.id
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid folder id.' }, { status: 400 })
  }

  const folderRes = await supabaseAdmin
    .from('notes_folders')
    .select('id, name')
    .eq('org_id', session.orgId)
    .eq('id', id)
    .maybeSingle()
  if (folderRes.error) {
    return NextResponse.json({ error: 'Unable to load folder.' }, { status: 500 })
  }
  if (!folderRes.data) {
    return NextResponse.json({ error: 'Folder not found.' }, { status: 404 })
  }

  const countRes = await supabaseAdmin
    .from('notes_notes')
    .select('id', { head: true, count: 'exact' })
    .eq('org_id', session.orgId)
    .eq('folder_id', id)
  if (countRes.error) {
    return NextResponse.json({ error: 'Unable to verify folder usage.' }, { status: 500 })
  }

  const count = countRes.count ?? 0
  const rawBody = await request.json().catch(() => null)
  const body = asRecord(rawBody) ?? {}
  const strategy = typeof body.strategy === 'string' ? body.strategy : null
  const targetFolderId = asOptionalTrimmedText(body.target_folder_id)

  if (count > 0 && !strategy) {
    return NextResponse.json(
      {
        error: 'Folder contains notes. Choose how to handle notes before deleting.',
        notes_count: count,
        required: true,
        strategies: ['uncategorize', 'move_to_folder'],
      },
      { status: 409 }
    )
  }

  if (count > 0 && strategy === 'move_to_folder') {
    if (!targetFolderId || !isUuid(targetFolderId) || targetFolderId === id) {
      return NextResponse.json({ error: 'Provide a different target_folder_id.' }, { status: 400 })
    }
    const targetRes = await supabaseAdmin
      .from('notes_folders')
      .select('id')
      .eq('org_id', session.orgId)
      .eq('id', targetFolderId)
      .maybeSingle()
    if (targetRes.error || !targetRes.data) {
      return NextResponse.json({ error: 'Target folder not found.' }, { status: 404 })
    }
    const moveRes = await supabaseAdmin
      .from('notes_notes')
      .update({ folder_id: targetFolderId })
      .eq('org_id', session.orgId)
      .eq('folder_id', id)
    if (moveRes.error) {
      return NextResponse.json({ error: 'Unable to move folder notes.' }, { status: 500 })
    }
  } else if (count > 0 && strategy === 'uncategorize') {
    const clearRes = await supabaseAdmin
      .from('notes_notes')
      .update({ folder_id: null })
      .eq('org_id', session.orgId)
      .eq('folder_id', id)
    if (clearRes.error) {
      return NextResponse.json({ error: 'Unable to uncategorize folder notes.' }, { status: 500 })
    }
  } else if (count > 0) {
    return NextResponse.json(
      { error: 'strategy must be uncategorize or move_to_folder when notes exist.' },
      { status: 400 }
    )
  }

  const del = await supabaseAdmin
    .from('notes_folders')
    .delete()
    .eq('org_id', session.orgId)
    .eq('id', id)
  if (del.error) {
    return NextResponse.json({ error: 'Unable to delete folder.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, deleted_folder_id: id })
}
