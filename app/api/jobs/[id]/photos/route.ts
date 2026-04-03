import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { uploadDriveFile } from '@/lib/server/googleDrive'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidPhase(value: unknown): value is 'before' | 'after' {
  return value === 'before' || value === 'after'
}

function sanitizeFileName(value: string) {
  return value.replace(/[^\w.\- ]+/g, '_').trim() || 'photo'
}

const maxPhotoSizeBytes = 10 * 1024 * 1024

export async function GET(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId } = session
  const params = await Promise.resolve(context.params)
  const jobId = params?.id
  if (!jobId || !uuid.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('job_photos')
    .select('id, phase, url, caption, sort_order, created_at')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .order('phase', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data ?? [] })
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

  const { orgId } = session
  const params = await Promise.resolve(context.params)
  const jobId = params?.id
  if (!jobId || !uuid.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  let phase: 'before' | 'after' = 'after'
  let url = ''
  let caption: string | null = null

  if (contentType.includes('multipart/form-data')) {
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
      return NextResponse.json({ error: 'Photo file is too large (max 10MB).' }, { status: 400 })
    }
    if (!fileValue.type || !fileValue.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are supported.' }, { status: 400 })
    }

    const captionField = form.get('caption')
    caption = typeof captionField === 'string' ? captionField.trim() : null
    phase = 'after'

    const folderId = process.env.GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID
    if (!folderId) {
      return NextResponse.json(
        { error: 'Missing env var: GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID' },
        { status: 500 }
      )
    }

    const baseName = sanitizeFileName(fileValue.name || 'photo.jpg')
    const driveName = `Job-${jobId}-after-${Date.now()}-${baseName}`
    const upload = await uploadDriveFile({
      origin: new URL(request.url).origin,
      orgId,
      userId: session.userId,
      folderId,
      name: driveName,
      mimeType: fileValue.type || 'application/octet-stream',
      data: Buffer.from(await fileValue.arrayBuffer()),
    })

    if ('error' in upload) {
      return NextResponse.json({ error: upload.error }, { status: 400 })
    }
    url = upload.file.webViewLink ?? `https://drive.google.com/file/d/${upload.file.id}/view`
  } else {
    const body = await request.json().catch(() => null)
    const incomingPhase = body?.phase
    url = typeof body?.url === 'string' ? body.url.trim() : ''
    caption = typeof body?.caption === 'string' ? body.caption.trim() : null

    if (!isValidPhase(incomingPhase)) {
      return NextResponse.json({ error: "Phase must be 'before' or 'after'" }, { status: 400 })
    }
    phase = incomingPhase

    if (!url) {
      return NextResponse.json({ error: 'Photo URL is required' }, { status: 400 })
    }

    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return NextResponse.json({ error: 'Photo URL must be http(s)' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Photo URL must be a valid URL' }, { status: 400 })
    }
  }

  const { data: existingRows, error: existingErr } = await supabaseAdmin
    .from('job_photos')
    .select('id')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('phase', phase)

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })

  const sortOrder = Array.isArray(existingRows) ? existingRows.length : 0

  const { data, error } = await supabaseAdmin
    .from('job_photos')
    .insert({
      org_id: orgId,
      job_id: jobId,
      phase,
      url,
      caption,
      sort_order: sortOrder,
    })
    .select('id, phase, url, caption, sort_order, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, photo: data })
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId } = session
  const params = await Promise.resolve(context.params)
  const jobId = params?.id
  if (!jobId || !uuid.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const photoId = typeof body?.photoId === 'string' ? body.photoId : ''
  if (!photoId || !uuid.test(photoId)) {
    return NextResponse.json({ error: 'Invalid photo id' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('job_photos')
    .delete()
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('id', photoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
