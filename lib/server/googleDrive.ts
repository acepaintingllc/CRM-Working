import { getValidAccessToken } from '@/lib/server/googleCalendar'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function normalizeStreet(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function extractStreet(address: string | null | undefined) {
  if (!address) return ''
  const first = address.split(',')[0] ?? ''
  return normalizeStreet(first)
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
  const json: any = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = json?.error?.message ?? 'Failed to list Drive files'
    return { error: msg } as const
  }

  const files: { id: string; name: string; webViewLink?: string | null }[] = json?.files ?? []
  const matches = files
    .map((f) => {
      const m = /^Estimate-(.+)-v(\d+)(?:\.pdf)?$/i.exec(f.name ?? '')
      if (!m) return null
      const streetPart = normalizeStreet(m[1])
      if (streetPart !== street) return null
      return { id: f.id, name: f.name, version: Number(m[2]), webViewLink: f.webViewLink ?? null }
    })
    .filter(Boolean) as { id: string; name: string; version: number; webViewLink?: string | null }[]

  if (!matches.length) {
    return { error: `No estimate PDF found for '${street}'.` } as const
  }

  matches.sort((a, b) => b.version - a.version)
  return { file: matches[0] } as const
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
    const json: any = await res.json().catch(() => null)
    const msg = json?.error?.message ?? 'Failed to download Drive file'
    return { error: msg } as const
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer } as const
}
