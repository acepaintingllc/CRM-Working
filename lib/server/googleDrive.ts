import { getValidAccessToken } from '@/lib/server/googleCalendar'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readGoogleErrorMessage(json: unknown) {
  const obj = asRecord(json)
  const err = asRecord(obj?.error)
  const msg = err?.message
  return typeof msg === 'string' ? msg : null
}

function normalizeStreet(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function extractStreet(address: string | null | undefined) {
  if (!address) return ''
  const first = address.split(',')[0] ?? ''
  return normalizeStreet(first)
}

function extractStreetRaw(address: string | null | undefined) {
  if (!address) return ''
  const first = address.split(',')[0] ?? ''
  return normalizeSpaces(first)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseEstimateFileName(name: string) {
  const m = /^Estimate-(.+)-v(\d+)(?:\.pdf)?$/i.exec(name)
  if (!m) return null
  const rawStreet = normalizeSpaces(m[1] ?? '')
  const normalizedStreet = normalizeStreet(rawStreet)
  const version = Number(m[2])
  if (!rawStreet || Number.isNaN(version)) return null
  return { rawStreet, normalizedStreet, version }
}

export async function findLatestEstimateFile(params: {
  origin: string
  orgId: string
  userId: string
  address: string | null | undefined
}) {
  const folderId = requireEnv('GOOGLE_DRIVE_ESTIMATES_FOLDER_ID')
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const rawStreet = extractStreetRaw(params.address)
  const street = extractStreet(params.address)
  if (!street) return { error: 'Customer address missing or invalid.' } as const

  const q = [
    `'${folderId}' in parents`,
    "mimeType='application/pdf'",
    'trashed=false',
    `name contains 'Estimate-'`,
  ].join(' and ')

  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('q', q)
  url.searchParams.set('fields', 'files(id,name,createdTime,modifiedTime,webViewLink)')
  url.searchParams.set('orderBy', 'modifiedTime desc')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${access.accessToken}` },
  })
  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = readGoogleErrorMessage(json) ?? 'Failed to list Drive files'
    return { error: msg } as const
  }

  const obj = asRecord(json)
  const rawFiles = Array.isArray(obj?.files) ? obj?.files : []
  const files: { id: string; name: string; webViewLink?: string | null }[] = rawFiles
    .map((f) => {
      const row = asRecord(f)
      if (!row) return null
      const id = row.id
      const name = row.name
      if (typeof id !== 'string' || typeof name !== 'string') return null
      const webViewLink = row.webViewLink
      return {
        id,
        name,
        webViewLink: typeof webViewLink === 'string' ? webViewLink : null,
      }
    })
    .filter(Boolean) as { id: string; name: string; webViewLink?: string | null }[]
  const parsed = files
    .map((f) => {
      const parsedName = parseEstimateFileName(f.name ?? '')
      if (!parsedName) return null
      return {
        id: f.id,
        name: f.name,
        webViewLink: f.webViewLink ?? null,
        ...parsedName,
      }
    })
    .filter(Boolean) as {
    id: string
    name: string
    rawStreet: string
    normalizedStreet: string
    version: number
    webViewLink?: string | null
  }[]

  const exactStreetPattern = new RegExp(
    `^Estimate-${escapeRegex(rawStreet)}-v(\\d+)(?:\\.pdf)?$`,
    'i'
  )
  const exactMatches = parsed.filter(
    (f) => exactStreetPattern.test(f.name) && f.normalizedStreet === street
  )
  const normalizedMatches = parsed.filter((f) => f.normalizedStreet === street)

  const chooseHighestVersion = <T extends { version: number }>(rows: T[]) =>
    rows.slice().sort((a, b) => b.version - a.version)[0] ?? null

  const exact = chooseHighestVersion(exactMatches)
  if (exact) {
    return {
      file: {
        id: exact.id,
        name: exact.name,
        version: exact.version,
        matchMode: 'exact' as const,
        webViewLink: exact.webViewLink ?? null,
      },
    } as const
  }

  const normalized = chooseHighestVersion(normalizedMatches)
  if (normalized) {
    return {
      file: {
        id: normalized.id,
        name: normalized.name,
        version: normalized.version,
        matchMode: 'normalized' as const,
        webViewLink: normalized.webViewLink ?? null,
      },
    } as const
  }

  return { error: 'No matching estimate PDF found in Drive folder.' } as const
}

export function getStreetFromAddress(address: string | null | undefined) {
  return extractStreet(address)
}

export function parseEstimateVersionFromName(name: string | null | undefined) {
  const parsed = parseEstimateFileName(name ?? '')
  if (!parsed) return null
  return { street: parsed.normalizedStreet, version: parsed.version }
}

export async function listEstimatePdfFiles(params: {
  origin: string
  orgId: string
  userId: string
}) {
  const folderId = requireEnv('GOOGLE_DRIVE_ESTIMATES_FOLDER_ID')
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const q = [
    `'${folderId}' in parents`,
    "mimeType='application/pdf'",
    'trashed=false',
    `name contains 'Estimate-'`,
  ].join(' and ')

  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('q', q)
  url.searchParams.set('fields', 'files(id,name,webViewLink)')
  url.searchParams.set('orderBy', 'modifiedTime desc')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${access.accessToken}` },
  })
  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = readGoogleErrorMessage(json) ?? 'Failed to list Drive files'
    return { error: msg } as const
  }

  const obj = asRecord(json)
  const rawFiles = Array.isArray(obj?.files) ? obj?.files : []
  const files = rawFiles
    .map((f) => {
      const row = asRecord(f)
      if (!row) return null
      const id = row.id
      const name = row.name
      if (typeof id !== 'string' || typeof name !== 'string') return null
      const webViewLink = row.webViewLink
      return {
        id,
        name,
        webViewLink: typeof webViewLink === 'string' ? webViewLink : null,
      }
    })
    .filter(Boolean) as { id: string; name: string; webViewLink: string | null }[]

  return { files } as const
}

export async function downloadDriveFile(params: {
  origin: string
  orgId: string
  userId: string
  fileId: string
}) {
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${params.fileId}`)
  url.searchParams.set('alt', 'media')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${access.accessToken}` },
  })

  if (!res.ok) {
    const json: unknown = await res.json().catch(() => null)
    const msg = readGoogleErrorMessage(json) ?? 'Failed to download Drive file'
    return { error: msg } as const
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer } as const
}

export async function exportDriveFile(params: {
  origin: string
  orgId: string
  userId: string
  fileId: string
  mimeType: string
}) {
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${params.fileId}/export`)
  url.searchParams.set('mimeType', params.mimeType)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${access.accessToken}` },
  })

  if (!res.ok) {
    const json: unknown = await res.json().catch(() => null)
    const msg = readGoogleErrorMessage(json) ?? 'Failed to export Drive file'
    return { error: msg } as const
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer } as const
}

export async function copyDriveFile(params: {
  origin: string
  orgId: string
  userId: string
  templateFileId: string
  folderId: string
  name: string
}) {
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.templateFileId)}/copy`
  )
  url.searchParams.set('supportsAllDrives', 'true')
  url.searchParams.set('fields', 'id,name,webViewLink')

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: params.name,
      parents: [params.folderId],
    }),
  })

  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = readGoogleErrorMessage(json) ?? 'Failed to copy Drive file'
    return { error: msg, status: res.status } as const
  }

  const obj = asRecord(json)
  const id = obj?.id
  const name = obj?.name
  if (typeof id !== 'string' || typeof name !== 'string') {
    return { error: 'Drive returned an invalid file response' } as const
  }

  const webViewLink = obj?.webViewLink
  return {
    file: {
      id,
      name,
      webViewLink: typeof webViewLink === 'string' ? webViewLink : null,
    },
  } as const
}
