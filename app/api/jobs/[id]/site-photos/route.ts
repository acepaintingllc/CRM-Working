import { NextResponse } from 'next/server'
import { deleteDriveFile, ensureDriveFolder, uploadDriveFile } from '@/lib/server/googleDrive'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const maxPhotoSizeBytes = 12 * 1024 * 1024
const defaultMasterSitePhotosFolderId = '1TPWScThG-eFX3zYDZ2oWN23mlmr0P6FA'

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

function asPhotoRow(value: Record<string, unknown> | null | undefined) {
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
  }
}

export async function GET(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const jobId = params?.id
  if (!jobId || !uuid.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('job_site_photos')
    .select('id, client_local_id, drive_file_id, url, caption, captured_at, uploaded_at, created_at')
    .eq('org_id', session.orgId)
    .eq('job_id', jobId)
    .order('captured_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: (data ?? []).map((row) => asPhotoRow(row)!).filter(Boolean) })
}

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const jobId = params?.id
  if (!jobId || !uuid.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart form upload.' }, { status: 400 })
  }

  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const fileValue = form.get('file')
  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: 'Photo file is required.' }, { status: 400 })
  }
  if (fileValue.size <= 0) {
    return NextResponse.json({ error: 'Photo file is empty.' }, { status: 400 })
  }
  if (fileValue.size > maxPhotoSizeBytes) {
    return NextResponse.json({ error: 'Photo file is too large (max 12MB).' }, { status: 400 })
  }
  if (!fileValue.type || !fileValue.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are supported.' }, { status: 400 })
  }

  const clientLocalId = typeof form.get('client_local_id') === 'string'
    ? String(form.get('client_local_id')).trim()
    : ''
  if (!clientLocalId || clientLocalId.length > 160) {
    return NextResponse.json({ error: 'client_local_id is required.' }, { status: 400 })
  }

  const captionField = form.get('caption')
  const caption = typeof captionField === 'string' ? captionField.trim() || null : null

  const capturedAtRaw = typeof form.get('captured_at') === 'string' ? String(form.get('captured_at')).trim() : ''
  const capturedAt = capturedAtRaw ? new Date(capturedAtRaw) : new Date()
  if (Number.isNaN(capturedAt.getTime())) {
    return NextResponse.json({ error: 'captured_at must be a valid date.' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from('job_site_photos')
    .select('id, client_local_id, drive_file_id, url, caption, captured_at, uploaded_at, created_at')
    .eq('org_id', session.orgId)
    .eq('job_id', jobId)
    .eq('client_local_id', clientLocalId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, photo: asPhotoRow(existing)! })
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, title')
    .eq('org_id', session.orgId)
    .eq('id', jobId)
    .maybeSingle()
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })

  const masterFolderId = getMasterSitePhotosFolderId()
  if (!masterFolderId) {
    return NextResponse.json(
      {
        error:
          'Missing env var: GOOGLE_DRIVE_SITE_PHOTOS_MASTER_FOLDER_ID (or GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID fallback)',
      },
      { status: 500 }
    )
  }

  const folderName = `Job-${jobId}-${sanitizeFolderName(typeof job.title === 'string' ? job.title : '')}`.slice(0, 120)
  const ensuredFolder = await ensureDriveFolder({
    origin: new URL(request.url).origin,
    orgId: session.orgId,
    userId: session.userId,
    parentFolderId: masterFolderId,
    name: folderName,
  })
  if ('error' in ensuredFolder) {
    return NextResponse.json({ error: ensuredFolder.error }, { status: 400 })
  }

  const extension = (() => {
    const name = fileValue.name || ''
    const idx = name.lastIndexOf('.')
    if (idx <= 0) return '.jpg'
    return name.slice(idx).toLowerCase()
  })()
  const timestamp = capturedAt.toISOString().replace(/[:.]/g, '-')
  const baseName = sanitizeName(
    `${timestamp}-${clientLocalId.slice(0, 12)}${extension}`
  )
  const upload = await uploadDriveFile({
    origin: new URL(request.url).origin,
    orgId: session.orgId,
    userId: session.userId,
    folderId: ensuredFolder.folder.id,
    name: baseName,
    mimeType: fileValue.type || 'application/octet-stream',
    data: Buffer.from(await fileValue.arrayBuffer()),
  })
  if ('error' in upload) {
    return NextResponse.json({ error: upload.error }, { status: 400 })
  }

  const driveUrl =
    upload.file.webViewLink ?? `https://drive.google.com/file/d/${upload.file.id}/view`

  const insertPayload = {
    org_id: session.orgId,
    job_id: jobId,
    client_local_id: clientLocalId,
    drive_file_id: upload.file.id,
    drive_folder_id: ensuredFolder.folder.id,
    url: driveUrl,
    caption,
    created_by_user_id: session.userId,
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
      const { data: duplicate } = await supabaseAdmin
        .from('job_site_photos')
        .select('id, client_local_id, drive_file_id, url, caption, captured_at, uploaded_at, created_at')
        .eq('org_id', session.orgId)
        .eq('job_id', jobId)
        .eq('client_local_id', clientLocalId)
        .maybeSingle()
      if (duplicate) {
        // Another request inserted first for the same client_local_id. Remove this duplicate Drive file.
        let cleanupError: string | null = null
        try {
          const cleanup = await deleteDriveFile({
            origin: new URL(request.url).origin,
            orgId: session.orgId,
            userId: session.userId,
            fileId: upload.file.id,
          })
          if ('error' in cleanup) {
            cleanupError = cleanup.error ?? null
          }
        } catch (error) {
          cleanupError = error instanceof Error ? error.message : 'Unknown cleanup failure'
        }
        if (cleanupError) {
          console.warn('Best-effort duplicate Drive cleanup failed:', cleanupError)
        }
        return NextResponse.json({ ok: true, duplicate: true, photo: asPhotoRow(duplicate)! })
      }
    }
    return NextResponse.json({ error: inserted.error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, photo: asPhotoRow(inserted.data)! })
}
