import { deleteDriveFile, ensureDriveFolder, uploadDriveFile } from '@/lib/server/googleDrive'
import { supabaseAdmin } from '@/lib/server/org'

const defaultMasterSitePhotosFolderId = '1TPWScThG-eFX3zYDZ2oWN23mlmr0P6FA'
const driveFileIdRegex = /^[A-Za-z0-9_-]{20,}$/

export type SitePhotoApiRow = {
  id: string
  client_local_id: string
  drive_file_id: string
  url: string
  caption: string | null
  captured_at: string | null
  uploaded_at: string | null
  created_at: string | null
}

function sanitizeName(value: string) {
  return value.replace(/[^\w.\- ]+/g, '_').trim() || 'photo'
}

function sanitizeFolderName(value: string) {
  const trimmed = value.replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim()
  return trimmed || 'Job'
}

function getMasterSitePhotosFolderId() {
  return (
    process.env.GOOGLE_DRIVE_SITE_PHOTOS_MASTER_FOLDER_ID ??
    process.env.GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID ??
    defaultMasterSitePhotosFolderId
  )
}

function parseDriveFileIdFromValue(value: string | null | undefined) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null
  if (driveFileIdRegex.test(normalized)) return normalized

  const fromPath = normalized.match(/\/d\/([A-Za-z0-9_-]{20,})/)
  if (fromPath?.[1]) return fromPath[1]
  const fromQuery = normalized.match(/[?&]id=([A-Za-z0-9_-]{20,})/)
  if (fromQuery?.[1]) return fromQuery[1]
  return null
}

export function asSitePhotoRow(value: Record<string, unknown> | null | undefined) {
  if (!value) return null
  return {
    id: typeof value.id === 'string' ? value.id : '',
    client_local_id: typeof value.client_local_id === 'string' ? value.client_local_id : '',
    drive_file_id: typeof value.drive_file_id === 'string' ? value.drive_file_id : '',
    url: typeof value.url === 'string' ? value.url : '',
    caption: typeof value.caption === 'string' ? value.caption : null,
    captured_at: typeof value.captured_at === 'string' ? value.captured_at : null,
    uploaded_at: typeof value.uploaded_at === 'string' ? value.uploaded_at : null,
    created_at: typeof value.created_at === 'string' ? value.created_at : null,
  } satisfies SitePhotoApiRow
}

export async function listSitePhotosForJob(orgId: string, jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('job_site_photos')
    .select('id, client_local_id, drive_file_id, url, caption, captured_at, uploaded_at, created_at')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .order('captured_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return { error: error.message } as const
  const photos = (data ?? []).map((row) => asSitePhotoRow(row)!).filter(Boolean)
  return { photos } as const
}

async function resolveJobPhotoFolderId(params: {
  origin: string
  orgId: string
  userId: string
  jobId: string
  jobTitle: string | null
}) {
  const latest = await supabaseAdmin
    .from('job_site_photos')
    .select('drive_folder_id')
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .not('drive_folder_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const existingFolderId = typeof latest.data?.drive_folder_id === 'string' ? latest.data.drive_folder_id : ''
  if (existingFolderId) {
    return { folderId: existingFolderId } as const
  }

  const masterFolderId = getMasterSitePhotosFolderId()
  if (!masterFolderId) {
    return {
      error:
        'Missing env var: GOOGLE_DRIVE_SITE_PHOTOS_MASTER_FOLDER_ID (or GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID fallback)',
    } as const
  }

  const folderName = `Job-${params.jobId}-${sanitizeFolderName(params.jobTitle ?? '')}`.slice(0, 120)
  const ensuredFolder = await ensureDriveFolder({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    parentFolderId: masterFolderId,
    name: folderName,
  })
  if ('error' in ensuredFolder) return { error: ensuredFolder.error } as const
  return { folderId: ensuredFolder.folder.id } as const
}

function fileExtensionForUpload(file: File) {
  const name = file.name || ''
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return '.jpg'
  return name.slice(idx).toLowerCase()
}

function driveViewUrl(fileId: string, webViewLink?: string | null) {
  return webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`
}

export async function createSitePhotoFromUpload(params: {
  origin: string
  orgId: string
  userId: string
  jobId: string
  clientLocalId: string
  caption: string | null
  capturedAtIso: string
  file: File
}) {
  const existing = await supabaseAdmin
    .from('job_site_photos')
    .select('id, client_local_id, drive_file_id, url, caption, captured_at, uploaded_at, created_at')
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('client_local_id', params.clientLocalId)
    .maybeSingle()
  if (existing.data) {
    return { ok: true as const, duplicate: true as const, photo: asSitePhotoRow(existing.data)! }
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, title')
    .eq('org_id', params.orgId)
    .eq('id', params.jobId)
    .maybeSingle()
  if (jobError) return { error: jobError.message, status: 500 } as const
  if (!job) return { error: 'Job not found.', status: 404 } as const

  const folder = await resolveJobPhotoFolderId({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    jobId: params.jobId,
    jobTitle: typeof job.title === 'string' ? job.title : null,
  })
  if ('error' in folder) return { error: folder.error, status: 400 } as const

  const capturedAt = new Date(params.capturedAtIso)
  const timestamp = capturedAt.toISOString().replace(/[:.]/g, '-')
  const baseName = sanitizeName(
    `${timestamp}-${params.clientLocalId.slice(0, 12)}${fileExtensionForUpload(params.file)}`
  )

  const upload = await uploadDriveFile({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    folderId: folder.folderId,
    name: baseName,
    mimeType: params.file.type || 'application/octet-stream',
    data: Buffer.from(await params.file.arrayBuffer()),
  })
  if ('error' in upload) return { error: upload.error, status: 400 } as const

  const insertPayload = {
    org_id: params.orgId,
    job_id: params.jobId,
    client_local_id: params.clientLocalId,
    drive_file_id: upload.file.id,
    drive_folder_id: folder.folderId,
    url: driveViewUrl(upload.file.id, upload.file.webViewLink ?? null),
    caption: params.caption,
    created_by_user_id: params.userId,
    captured_at: capturedAt.toISOString(),
    uploaded_at: new Date().toISOString(),
  }

  const inserted = await supabaseAdmin
    .from('job_site_photos')
    .insert(insertPayload)
    .select('id, client_local_id, drive_file_id, url, caption, captured_at, uploaded_at, created_at')
    .single()

  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const duplicate = await supabaseAdmin
        .from('job_site_photos')
        .select('id, client_local_id, drive_file_id, url, caption, captured_at, uploaded_at, created_at')
        .eq('org_id', params.orgId)
        .eq('job_id', params.jobId)
        .eq('client_local_id', params.clientLocalId)
        .maybeSingle()

      if (duplicate.data) {
        await deleteDriveFile({
          origin: params.origin,
          orgId: params.orgId,
          userId: params.userId,
          fileId: upload.file.id,
        }).catch(() => ({ ok: true }))

        return {
          ok: true as const,
          duplicate: true as const,
          photo: asSitePhotoRow(duplicate.data)!,
        }
      }
    }
    return { error: inserted.error.message, status: 500 } as const
  }

  return { ok: true as const, duplicate: false as const, photo: asSitePhotoRow(inserted.data)! }
}

export async function createSitePhotoFromUrl(params: {
  orgId: string
  userId: string
  jobId: string
  url: string
  caption: string | null
  capturedAtIso: string
  clientLocalId: string
}) {
  const driveFileId = parseDriveFileIdFromValue(params.url)
  if (!driveFileId) {
    return {
      error: 'Photo URL must be a Google Drive file URL/id.',
      status: 400,
    } as const
  }

  const insert = await supabaseAdmin
    .from('job_site_photos')
    .insert({
      org_id: params.orgId,
      job_id: params.jobId,
      client_local_id: params.clientLocalId,
      drive_file_id: driveFileId,
      drive_folder_id: null,
      url: params.url,
      caption: params.caption,
      created_by_user_id: params.userId,
      captured_at: params.capturedAtIso,
      uploaded_at: new Date().toISOString(),
    })
    .select('id, client_local_id, drive_file_id, url, caption, captured_at, uploaded_at, created_at')
    .single()

  if (insert.error) return { error: insert.error.message, status: 500 } as const
  return { ok: true as const, photo: asSitePhotoRow(insert.data)! }
}

export async function updateSitePhotoCaption(params: {
  orgId: string
  jobId: string
  photoId: string
  caption: string | null
}) {
  const { data, error } = await supabaseAdmin
    .from('job_site_photos')
    .update({ caption: params.caption })
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('id', params.photoId)
    .select('id, client_local_id, drive_file_id, url, caption, captured_at, uploaded_at, created_at')
    .maybeSingle()

  if (error) return { error: error.message, status: 500 } as const
  if (!data) return { error: 'Photo not found.', status: 404 } as const
  return { ok: true as const, photo: asSitePhotoRow(data)! }
}

export async function deleteSitePhoto(params: {
  origin: string
  orgId: string
  userId: string
  jobId: string
  photoId: string
}) {
  const existing = await supabaseAdmin
    .from('job_site_photos')
    .select('id, drive_file_id')
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('id', params.photoId)
    .maybeSingle()

  if (existing.error) return { error: existing.error.message, status: 500 } as const
  if (!existing.data) return { error: 'Photo not found.', status: 404 } as const

  const driveFileId = parseDriveFileIdFromValue(existing.data.drive_file_id)
  if (driveFileId) {
    const driveDelete = await deleteDriveFile({
      origin: params.origin,
      orgId: params.orgId,
      userId: params.userId,
      fileId: driveFileId,
    })
    if ('error' in driveDelete) return { error: driveDelete.error, status: 400 } as const
  }

  const deleted = await supabaseAdmin
    .from('job_site_photos')
    .delete()
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('id', params.photoId)

  if (deleted.error) return { error: deleted.error.message, status: 500 } as const
  return { ok: true as const }
}

