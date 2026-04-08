import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { isUuid } from '@/lib/notes/server'
import type { NotesNoteRow } from '@/lib/notes/types'

type Params = { id: string } | Promise<{ id: string }>

export async function POST(_: Request, context: { params: Params }) {
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

  const update = await supabaseAdmin
    .from('notes_notes')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('org_id', session.orgId)
    .eq('id', id)
    .select('*')
    .single()

  if (update.error || !update.data) {
    return NextResponse.json({ error: 'Unable to archive note.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, note: update.data as NotesNoteRow })
}
