import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { isUuid } from '@/lib/notes/server'
import type { NotesTaskRow } from '@/lib/notes/types'

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
    return NextResponse.json({ error: 'Invalid task id.' }, { status: 400 })
  }

  const update = await supabaseAdmin
    .from('notes_tasks')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
    .eq('org_id', session.orgId)
    .eq('id', id)
    .select('*')
    .single()

  if (update.error) {
    return NextResponse.json({ error: 'Unable to archive task.' }, { status: 500 })
  }
  if (!update.data) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, task: update.data as NotesTaskRow })
}
