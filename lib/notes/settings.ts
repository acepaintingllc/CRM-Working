import { supabaseAdmin } from '@/lib/server/org'
import type { NotesSettingsRow } from '@/lib/notes/types'
import { getOrgNotesDefaults } from '@/lib/notes/server'
import { buildNotesSettingsDefaults } from '@/lib/notes/settingsDefaults'

export { buildNotesSettingsDefaults } from '@/lib/notes/settingsDefaults'

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

  return {
    settings,
    defaults: buildNotesSettingsDefaults({
      settings,
      orgDefaults,
      fallbackUserId: params.fallbackUserId,
    }),
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
