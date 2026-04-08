import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'

export async function DELETE() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const countRes = await supabaseAdmin
    .from('notes_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', session.orgId)
    .eq('status', 'completed')

  if (countRes.error) {
    return NextResponse.json({ error: 'Unable to count completed tasks.' }, { status: 500 })
  }
  const deletedCount = countRes.count ?? 0

  const del = await supabaseAdmin
    .from('notes_tasks')
    .delete()
    .eq('org_id', session.orgId)
    .eq('status', 'completed')

  if (del.error) {
    return NextResponse.json({ error: 'Unable to delete completed tasks.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted_count: deletedCount })
}
