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

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
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
  const m = /^Estimate-(.+)-v(\d+)(?:-.+)?(?:\.pdf)?$/i.exec(name)
  if (!m) return null
  const rawStreet = normalizeSpaces(m[1] ?? '')
  const normalizedStreet = normalizeStreet(rawStreet)
  const version = Number(m[2])
  if (!rawStreet || Number.isNaN(version)) return null
  return { rawStreet, normalizedStreet, version }
}

export type EstimateDriveMatchMode = 'exact' | 'normalized'

export type EstimateDriveMatchedFile = {
  id: string
  name: string
  version: number
  matchMode: EstimateDriveMatchMode
  webViewLink?: string | null
}

function chooseHighestVersion<T extends { version: number }>(rows: T[]) {
  return rows.slice().sort((a, b) => b.version - a.version)[0] ?? null
}

function sortMatchedFiles(
  rows: Array<
    EstimateDriveMatchedFile & {
      rawStreet: string
      normalizedStreet: string
    }
  >
) {
  return rows.slice().sort((a, b) => {
    if (a.version !== b.version) return b.version - a.version
    if (a.matchMode !== b.matchMode) return a.matchMode === 'exact' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function findMatchingEstimateFiles(params: {
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
    `^Estimate-${escapeRegex(rawStreet)}-v(\\d+)(?:-.+)?(?:\\.pdf)?$`,
    'i'
  )
  const exactMatches = parsed
    .filter((f) => exactStreetPattern.test(f.name) && f.normalizedStreet === street)
    .map((f) => ({ ...f, matchMode: 'exact' as const }))
  const normalizedMatches = parsed
    .filter((f) => f.normalizedStreet === street)
    .map((f) => ({ ...f, matchMode: 'normalized' as const }))

  const dedupedById = new Map<
    string,
    EstimateDriveMatchedFile & {
      rawStreet: string
      normalizedStreet: string
    }
  >()
  for (const row of exactMatches) dedupedById.set(row.id, row)
  for (const row of normalizedMatches) {
    if (dedupedById.has(row.id)) continue
    dedupedById.set(row.id, row)
  }

  const matches = sortMatchedFiles(Array.from(dedupedById.values())).map((row) => ({
    id: row.id,
    name: row.name,
    version: row.version,
    matchMode: row.matchMode,
    webViewLink: row.webViewLink ?? null,
  }))

  if (matches.length === 0) {
    return { error: 'No matching estimate PDF found in Drive folder.' } as const
  }

  return { files: matches } as const
}

export async function findLatestEstimateFile(params: {
  origin: string
  orgId: string
  userId: string
  address: string | null | undefined
}): Promise<
  | { file: EstimateDriveMatchedFile }
  | { error: string }
> {
  const matching = await findMatchingEstimateFiles(params)
  if ('error' in matching && typeof matching.error === 'string') {
    return { error: matching.error }
  }
  const matchedFiles =
    'files' in matching && Array.isArray(matching.files) ? matching.files : []
  const exact = chooseHighestVersion(
    matchedFiles.filter((row) => row.matchMode === 'exact')
  )
  if (exact) {
    return {
      file: exact,
    } as const
  }
  const normalized = chooseHighestVersion(
    matchedFiles.filter((row) => row.matchMode === 'normalized')
  )
  if (normalized) {
    return {
      file: normalized,
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

export async function uploadDriveFile(params: {
  origin: string
  orgId: string
  userId: string
  folderId: string
  name: string
  mimeType: string
  data: Buffer
}) {
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const boundary = `acecrm_upload_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const metadata = JSON.stringify({
    name: params.name,
    parents: [params.folderId],
  })

  const head = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${params.mimeType}\r\n\r\n`,
    'utf8'
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  const body = Buffer.concat([head, params.data, tail])

  const url = new URL('https://www.googleapis.com/upload/drive/v3/files')
  url.searchParams.set('uploadType', 'multipart')
  url.searchParams.set('fields', 'id,name,webViewLink')
  url.searchParams.set('supportsAllDrives', 'true')

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access.accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })

  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = readGoogleErrorMessage(json) ?? 'Failed to upload Drive file'
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

export async function ensureDriveFolder(params: {
  origin: string
  orgId: string
  userId: string
  parentFolderId: string
  name: string
}) {
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const q = [
    `'${escapeDriveQueryValue(params.parentFolderId)}' in parents`,
    "mimeType='application/vnd.google-apps.folder'",
    'trashed=false',
    `name='${escapeDriveQueryValue(params.name)}'`,
  ].join(' and ')

  const listUrl = new URL('https://www.googleapis.com/drive/v3/files')
  listUrl.searchParams.set('q', q)
  listUrl.searchParams.set('fields', 'files(id,name,webViewLink)')
  listUrl.searchParams.set('pageSize', '1')
  listUrl.searchParams.set('supportsAllDrives', 'true')
  listUrl.searchParams.set('includeItemsFromAllDrives', 'true')

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${access.accessToken}` },
  })
  const listJson: unknown = await listRes.json().catch(() => null)
  if (!listRes.ok) {
    const msg = readGoogleErrorMessage(listJson) ?? 'Failed to list Drive folders'
    return { error: msg } as const
  }

  const listObj = asRecord(listJson)
  const files = Array.isArray(listObj?.files) ? listObj.files : []
  const existing = files
    .map((file) => {
      const row = asRecord(file)
      if (!row) return null
      const id = row.id
      const name = row.name
      const webViewLink = row.webViewLink
      if (typeof id !== 'string' || typeof name !== 'string') return null
      return {
        id,
        name,
        webViewLink: typeof webViewLink === 'string' ? webViewLink : null,
      }
    })
    .find(Boolean)

  if (existing) {
    return { folder: existing } as const
  }

  const createUrl = new URL('https://www.googleapis.com/drive/v3/files')
  createUrl.searchParams.set('fields', 'id,name,webViewLink')
  createUrl.searchParams.set('supportsAllDrives', 'true')

  const createRes = await fetch(createUrl.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: params.name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [params.parentFolderId],
    }),
  })
  const createJson: unknown = await createRes.json().catch(() => null)
  if (!createRes.ok) {
    const msg = readGoogleErrorMessage(createJson) ?? 'Failed to create Drive folder'
    return { error: msg } as const
  }

  const created = asRecord(createJson)
  const id = created?.id
  const name = created?.name
  if (typeof id !== 'string' || typeof name !== 'string') {
    return { error: 'Drive returned an invalid folder response' } as const
  }
  const webViewLink = created?.webViewLink
  return {
    folder: {
      id,
      name,
      webViewLink: typeof webViewLink === 'string' ? webViewLink : null,
    },
  } as const
}

export async function deleteDriveFile(params: {
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

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.fileId)}`)
  url.searchParams.set('supportsAllDrives', 'true')

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${access.accessToken}` },
  })

  if (res.status === 404) {
    return { ok: true } as const
  }
  if (!res.ok) {
    const json: unknown = await res.json().catch(() => null)
    const msg = readGoogleErrorMessage(json) ?? 'Failed to delete Drive file'
    return { error: msg } as const
  }

  return { ok: true } as const
}
