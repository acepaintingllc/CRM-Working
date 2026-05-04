import { UUID_RE } from '../../validation/uuid.ts'

export const uuid = UUID_RE

export const VERSION_STATES = new Set(['draft', 'live', 'archived'])

export const estimateSelect =
  'id, org_id, job_id, customer_id, status, version_name, version_state, version_kind, version_sort_order, setting_set_id_used, created_at, updated_at'

export function asText(value: unknown) {
  return String(value ?? '').trim()
}

export function asMoney(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function asTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

export function compareNullableTimestampDescIdDesc(
  left: { timestamp: string | null | undefined; id: string },
  right: { timestamp: string | null | undefined; id: string }
) {
  const leftHasTimestamp = Boolean(left.timestamp)
  const rightHasTimestamp = Boolean(right.timestamp)
  if (leftHasTimestamp && rightHasTimestamp) {
    const timestampDiff = asTimestamp(right.timestamp) - asTimestamp(left.timestamp)
    if (timestampDiff !== 0) return timestampDiff
  } else if (leftHasTimestamp !== rightHasTimestamp) {
    return leftHasTimestamp ? -1 : 1
  }

  return right.id.localeCompare(left.id)
}

export function isAfterNullableTimestampDescIdCursor(
  row: { timestamp: string | null | undefined; id: string },
  cursor: { timestamp: string | null; id: string }
) {
  return compareNullableTimestampDescIdDesc(row, cursor) > 0
}
