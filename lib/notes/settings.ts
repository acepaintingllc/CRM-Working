import { supabaseAdmin } from '@/lib/server/org'
import type { NotesSettingsRow } from '@/lib/notes/types'
import { getOrgNotesDefaults } from '@/lib/notes/server'
import { parseHHMM, resolveTimeZone } from '@/lib/notes/time'

export async function getNotesSettings(orgId: string) {
  const { data, error } = await supabaseAdmin
    .from('notes_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as NotesSettingsRow | null
}

export async function getNotesSettingsWithDefaults(params: {
  orgId: string
  fallbackUserId?: string | null
}) {
  const [settings, orgDefaults] = await Promise.all([
    getNotesSettings(params.orgId),
    getOrgNotesDefaults(params.orgId),
  ])

  const timezone = resolveTimeZone(settings?.timezone ?? orgDefaults.timezone)
  const showUpcomingDays =
    settings?.show_upcoming_days != null
      ? Math.max(0, Math.min(14, settings.show_upcoming_days))
      : 3
  const parsedTime = parseHHMM(settings?.daily_summary_time_local ?? null)
  const dailySummaryTimeLocal = parsedTime
    ? `${String(parsedTime.hour).padStart(2, '0')}:${String(parsedTime.minute).padStart(2, '0')}`
    : '06:00'

  return {
    settings,
    defaults: {
      orgName: orgDefaults.name,
      timezone,
      showUpcomingDays,
      dailySummaryTimeLocal,
      dailySummaryEmailTo: settings?.daily_summary_email_to ?? orgDefaults.businessEmail ?? null,
      senderUserId: settings?.sender_user_id ?? params.fallbackUserId ?? null,
    },
  }
}

export async function upsertNotesSettings(params: {
  orgId: string
  senderUserId: string | null
  dailySummaryEmailTo: string | null
  dailySummaryTimeLocal: string
  timezone: string
  showUpcomingDays: number
}) {
  const payload = {
    org_id: params.orgId,
    sender_user_id: params.senderUserId,
    daily_summary_email_to: params.dailySummaryEmailTo,
    daily_summary_time_local: params.dailySummaryTimeLocal,
    timezone: params.timezone,
    show_upcoming_days: params.showUpcomingDays,
  }
  const { data, error } = await supabaseAdmin
    .from('notes_settings')
    .upsert(payload, { onConflict: 'org_id' })
    .select('*')
    .single()
  if (error) throw error
  return data as NotesSettingsRow
}
