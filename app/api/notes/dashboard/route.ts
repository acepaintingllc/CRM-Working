import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { getNotesSettingsWithDefaults } from '@/lib/notes/settings'
import { partitionTasksForDashboard } from '@/lib/notes/reminders'
import type { NotesNoteRow, NotesTaskRow } from '@/lib/notes/types'

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId, userId } = session
  try {
    const [{ defaults }, tasksRes, notesRes] = await Promise.all([
      getNotesSettingsWithDefaults({ orgId, fallbackUserId: userId }),
      supabaseAdmin
        .from('notes_tasks')
        .select('*')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('due_at', { ascending: true })
        .limit(300),
      supabaseAdmin
        .from('notes_notes')
        .select('*')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(30),
    ])

    if (tasksRes.error) {
      return NextResponse.json({ error: 'Unable to load tasks.' }, { status: 500 })
    }
    if (notesRes.error) {
      return NextResponse.json({ error: 'Unable to load notes.' }, { status: 500 })
    }

    const tasks = (tasksRes.data ?? []) as NotesTaskRow[]
    const notes = (notesRes.data ?? []) as NotesNoteRow[]
    const grouped = partitionTasksForDashboard({
      tasks,
      now: new Date(),
      timeZone: defaults.timezone,
      upcomingDays: defaults.showUpcomingDays,
    })

    const uncategorized = notes.filter((row) => row.folder_id == null).slice(0, 6)
    const uncategorizedIds = new Set(uncategorized.map((row) => row.id))
    const recent = [
      ...uncategorized,
      ...notes.filter((row) => !uncategorizedIds.has(row.id)).slice(0, Math.max(0, 6 - uncategorized.length)),
    ]

    return NextResponse.json({
      today: {
        timezone: defaults.timezone,
        date_key: grouped.dateKey,
      },
      settings: {
        upcoming_days: defaults.showUpcomingDays,
      },
      tasks: {
        overdue: grouped.overdue,
        due_today: grouped.dueToday,
        upcoming: grouped.upcoming,
        untimed_today: grouped.untimedToday,
      },
      notes: {
        recent,
        uncategorized,
      },
      quick_add_path: '/crm/notes/quick-add',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load notes dashboard.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
