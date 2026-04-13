import { NextResponse } from 'next/server'
import { deleteDriveFile } from '@/lib/server/googleDrive'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeCaption(value: unknown) {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function validateIds(jobId: string | undefined, photoId: string | undefined) {
  if (!jobId || !uuid.test(jobId)) return 'Invalid job id'
  if (!photoId || !uuid.test(photoId)) return 'Invalid photo id'
  return null
}

export async function PATCH(
  request: Request,
  context: { params: { id: string; photoId: string } | Promise<{ id: string; photoId: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const validationError = validateIds(params?.id, params?.photoId)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || !('caption' in body)) {
    return NextResponse.json({ error: 'caption is required.' }, { status: 400 })
  }

  const caption = normalizeCaption(body.caption)
  const { data, error } = await supabaseAdmin
    .from('job_site_photos')
    .update({ caption })
    .eq('org_id', session.orgId)
    .eq('job_id', params.id)
    .eq('id', params.photoId)
    .select('id, client_local_id, drive_file_id, url, caption, captured_at, uploaded_at, created_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 })
  return NextResponse.json({ ok: true, photo: data })
}

export async function DELETE(
  request: Request,
  context: { params: { id: string; photoId: string } | Promise<{ id: string; photoId: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const validationError = validateIds(params?.id, params?.photoId)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('job_site_photos')
    .select('id, drive_file_id')
    .eq('org_id', session.orgId)
    .eq('job_id', params.id)
    .eq('id', params.photoId)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 })

  const driveDelete = await deleteDriveFile({
    origin: new URL(request.url).origin,
    orgId: session.orgId,
    userId: session.userId,
    fileId: String(existing.drive_file_id),
  })
  if ('error' in driveDelete) {
    return NextResponse.json({ error: driveDelete.error }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('job_site_photos')
    .delete()
    .eq('org_id', session.orgId)
    .eq('job_id', params.id)
    .eq('id', params.photoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
