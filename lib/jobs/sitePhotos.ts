export const JOB_SITE_PHOTO_CATEGORIES = ['before', 'damage', 'after'] as const

export type JobSitePhotoCategory = (typeof JOB_SITE_PHOTO_CATEGORIES)[number]

export const JOB_SITE_PHOTO_LIMITS = {
  maxFiles: 20,
  maxBytesPerFile: 15 * 1024 * 1024,
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
} as const

export type JobSitePhotoRecord = {
  id: string
  org_id: string
  job_id: string
  category: JobSitePhotoCategory
  drive_file_id: string
  drive_folder_id: string | null
  drive_url: string | null
  file_name: string
  original_name: string | null
  mime_type: string | null
  size_bytes: number | null
  captured_at: string
  client_local_id: string | null
  created_at: string
  updated_at: string | null
}

export type JobSitePhotoResponse = {
  id: string
  job_id: string
  category: JobSitePhotoCategory
  drive_file_id: string
  drive_url: string | null
  file_name: string
  original_name: string | null
  mime_type: string | null
  size_bytes: number | null
  captured_at: string
  client_local_id: string | null
  created_at: string
}

export type JobSitePhotoFolderRecord = {
  id: string
  org_id: string
  job_id: string
  drive_folder_id: string
  drive_folder_url: string | null
  folder_name: string
  created_at: string
  updated_at: string | null
}

export type JobSitePhotoFolderResponse = {
  job_id: string
  drive_folder_id: string
  drive_folder_url: string | null
  folder_name: string
}

export type JobSitePhotoUploadFile = {
  buffer: Buffer | Uint8Array | ArrayBuffer
  originalName: string
  mimeType: string
  sizeBytes: number
  category: JobSitePhotoCategory
  capturedAt?: string | Date | null
  clientLocalId?: string | null
}

export type UploadJobSitePhotosInput = {
  orgId: string
  jobId: string
  files: JobSitePhotoUploadFile[]
}

export function isJobSitePhotoCategory(value: unknown): value is JobSitePhotoCategory {
  return typeof value === 'string' && JOB_SITE_PHOTO_CATEGORIES.includes(value as JobSitePhotoCategory)
}

export function normalizeDriveFolderName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/-{2,}/g, '-')
    .trim()
}

export function deriveJobPhotoFolderName(input: {
  customerAddress?: string | null
  title?: string | null
}): string {
  const address = normalizeDriveFolderName(input.customerAddress ?? '')
  if (address) return address

  const title = normalizeDriveFolderName(input.title ?? '')
  if (title) return title

  return 'Untitled job'
}

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'])

export function getSafeJobPhotoExtension(input: {
  originalName?: string | null
  mimeType?: string | null
}): string {
  const originalName = input.originalName ?? ''
  const lastDotIndex = originalName.lastIndexOf('.')
  const rawExtension = lastDotIndex >= 0 ? originalName.slice(lastDotIndex + 1).toLowerCase() : ''

  if (allowedExtensions.has(rawExtension)) {
    return rawExtension === 'jpeg' ? 'jpg' : rawExtension
  }

  const mimeExtension = extensionByMimeType[(input.mimeType ?? '').toLowerCase()]
  return mimeExtension ?? 'jpg'
}

function formatUtcTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const second = String(date.getUTCSeconds()).padStart(2, '0')

  return `${year}-${month}-${day}_${hour}-${minute}-${second}`
}

function shortClientLocalId(value: string | null | undefined): string {
  const sanitized = (value ?? '').replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 9)
  return sanitized || 'upload'
}

export function buildJobPhotoDriveFileName(input: {
  capturedAt: string | Date
  category: JobSitePhotoCategory
  clientLocalId?: string | null
  originalName?: string | null
  mimeType?: string | null
}): string {
  const timestamp = formatUtcTimestamp(input.capturedAt)
  const clientId = shortClientLocalId(input.clientLocalId)
  const extension = getSafeJobPhotoExtension({
    originalName: input.originalName,
    mimeType: input.mimeType,
  })

  return `${timestamp}_${input.category}_${clientId}.${extension}`
}

export function buildDriveFolderUrl(folderId: string | null | undefined): string | null {
  if (!folderId) return null
  return `https://drive.google.com/drive/folders/${folderId}`
}
