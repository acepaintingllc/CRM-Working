import { supabaseAdmin } from '@/lib/server/org'
import { parseRecurrenceRule, type NotesPriority } from '@/lib/notes/types'
import { resolveTimeZone } from '@/lib/notes/time'

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function asText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function asOptionalTrimmedText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function asBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return fallback
}

export function asNullableIso(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function asNullableInt(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return Number(value)
  }
  return null
}

export function asPriority(value: unknown): NotesPriority | null {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return null
}

export function normalizeReminderOffset(value: unknown) {
  const n = asNullableInt(value)
  if (n == null) return null
  if (n < 0) return null
  return n
}

export function deriveReminderAt(params: {
  reminderEnabled: boolean
  reminderAtIso?: string | null
  dueAtIso?: string | null
  reminderOffsetMinutes?: number | null
}) {
  if (!params.reminderEnabled) return null

  if (params.reminderAtIso) return params.reminderAtIso
  if (!params.dueAtIso) return null

  const due = new Date(params.dueAtIso)
  if (Number.isNaN(due.getTime())) return null

  if (params.reminderOffsetMinutes != null) {
    return new Date(due.getTime() - params.reminderOffsetMinutes * 60 * 1000).toISOString()
  }
  return due.toISOString()
}

export function parseTaskRecurrenceRule(value: unknown) {
  if (value == null) return null
  return parseRecurrenceRule(value)
}

type OrgRow = Record<string, unknown>

function pickFirst(row: OrgRow, candidates: string[]) {
  for (const key of candidates) {
    if (!(key in row)) continue
    const raw = row[key]
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  return null
}

export async function getOrgNotesDefaults(orgId: string) {
  const { data: orgRow, error } = await supabaseAdmin
    .from('orgs')
    .select('*')
    .eq('id', orgId)
    .maybeSingle()
  if (error) throw error

  const row = (orgRow ?? {}) as OrgRow
  const name =
    pickFirst(row, ['name', 'business_name', 'company_name']) ??
    'ACE Painting CRM'
  const timezone = resolveTimeZone(
    pickFirst(row, ['timezone', 'time_zone', 'tz']) ?? 'America/Chicago'
  )
  const businessEmail = pickFirst(row, ['business_email', 'email', 'company_email', 'from_email'])

  return { name, timezone, businessEmail }
}

export async function resolveOrgSenderUserId(orgId: string) {
  const { data, error } = await supabaseAdmin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  const userId = data?.user_id
  return typeof userId === 'string' ? userId : null
}
