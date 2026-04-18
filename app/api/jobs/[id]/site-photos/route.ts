import { NextResponse } from 'next/server'
import {
  createSitePhotoFromUpload,
  listSitePhotosForJob,
} from '@/lib/server/sitePhotos'
import {
  enforceContentLength,
  jsonError,
  requireMultipartFormData,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'

const maxPhotoSizeBytes = 12 * 1024 * 1024
const maxUploadRequestBytes = maxPhotoSizeBytes + 512 * 1024

export async function GET(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const jobParam = readUuidParam(params?.id, 'job id')
  if (!jobParam.ok) return jobParam.response

  const list = await listSitePhotosForJob(auth.session.orgId, jobParam.value)
  if ('error' in list) return jsonError(list.error ?? 'Unable to load site photos.', 500)
  return NextResponse.json({ photos: list.photos })
}

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const jobParam = readUuidParam(params?.id, 'job id')
  if (!jobParam.ok) return jobParam.response
  const jobId = jobParam.value

  const typeCheck = requireMultipartFormData(request)
  if (!typeCheck.ok) return typeCheck.response
  const lengthCheck = enforceContentLength(request, maxUploadRequestBytes)
  if (!lengthCheck.ok) return lengthCheck.response

  const form = await request.formData().catch(() => null)
  if (!form) return jsonError('Invalid form data.', 400)

  const fileValue = form.get('file')
  if (!(fileValue instanceof File)) return jsonError('Photo file is required.', 400)
  if (fileValue.size <= 0) return jsonError('Photo file is empty.', 400)
  if (fileValue.size > maxPhotoSizeBytes) {
    return jsonError('Photo file is too large (max 12MB).', 400)
  }
  if (!fileValue.type || !fileValue.type.startsWith('image/')) {
    return jsonError('Only image files are supported.', 400)
  }

  const clientLocalId = typeof form.get('client_local_id') === 'string'
    ? String(form.get('client_local_id')).trim()
    : ''
  if (!clientLocalId || clientLocalId.length > 160) {
    return jsonError('client_local_id is required.', 400)
  }

  const captionField = form.get('caption')
  const caption = typeof captionField === 'string' ? captionField.trim() || null : null
  const capturedAtRaw =
    typeof form.get('captured_at') === 'string'
      ? String(form.get('captured_at')).trim()
      : ''
  const capturedAt = capturedAtRaw ? new Date(capturedAtRaw) : new Date()
  if (Number.isNaN(capturedAt.getTime())) {
    return jsonError('captured_at must be a valid date.', 400)
  }

  const created = await createSitePhotoFromUpload({
    origin: new URL(request.url).origin,
    orgId: auth.session.orgId,
    userId: auth.session.userId,
    jobId,
    clientLocalId,
    caption,
    capturedAtIso: capturedAt.toISOString(),
    file: fileValue,
  })
  if ('error' in created) return jsonError(created.error ?? 'Unable to create site photo.', created.status ?? 500)
  return NextResponse.json({
    ok: true,
    duplicate: created.duplicate,
    photo: created.photo,
  })
}
