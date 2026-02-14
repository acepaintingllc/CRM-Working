import { getValidAccessToken } from '@/lib/server/googleCalendar'

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readGoogleErrorMessage(json: unknown) {
  const obj = asRecord(json)
  const err = asRecord(obj?.error)
  const msg = err?.message
  return typeof msg === 'string' ? msg : null
}

type SheetsCell = string | number | boolean | null

type RangeUpdate = {
  range: string
  values: SheetsCell[][]
}

export async function writeRangeValues(params: {
  origin: string
  orgId: string
  userId: string
  spreadsheetId: string
  updates: RangeUpdate[]
}) {
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values:batchUpdate`
  )

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: params.updates.map((u) => ({
        range: u.range,
        values: u.values,
      })),
    }),
  })

  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = readGoogleErrorMessage(json) ?? 'Failed to write to Google Sheets'
    return { error: msg, status: res.status } as const
  }

  return { ok: true } as const
}

export async function writeNamedRanges(params: {
  origin: string
  orgId: string
  userId: string
  spreadsheetId: string
  updates: { range: string; value: string }[]
}) {
  return writeRangeValues({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    spreadsheetId: params.spreadsheetId,
    updates: params.updates.map((u) => ({
      range: u.range,
      values: [[u.value]],
    })),
  })
}

export async function readNamedRangeValues(params: {
  origin: string
  orgId: string
  userId: string
  spreadsheetId: string
  range: string
}) {
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values/${encodeURIComponent(params.range)}`
  )

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${access.accessToken}` },
  })
  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = readGoogleErrorMessage(json) ?? 'Failed to read from Google Sheets'
    return { error: msg, status: res.status } as const
  }

  const obj = asRecord(json)
  const rawValues = Array.isArray(obj?.values) ? obj?.values : []
  const values = rawValues
    .map((row) => (Array.isArray(row) ? row.map((cell) => (cell == null ? '' : String(cell))) : []))
    .filter((row) => row.length > 0)

  return { values } as const
}
