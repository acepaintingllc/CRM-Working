import { deleteSitePhoto, updateSitePhotoCaption } from '@/lib/server/sitePhotos'
import {
  jsonError,
  readJsonBody,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { mutationResponse } from '@/lib/server/routeResult'

function normalizeCaption(value: unknown) {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function validateIds(jobId: unknown, photoId: unknown) {
  const jobParam = readUuidParam(jobId, 'job id')
  if (!jobParam.ok) return jobParam
  const photoParam = readUuidParam(photoId, 'photo id')
  if (!photoParam.ok) return photoParam
  return { ok: true as const, jobId: jobParam.value, photoId: photoParam.value }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string; photoId: string } | Promise<{ id: string; photoId: string }> }
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const ids = validateIds(params?.id, params?.photoId)
  if (!ids.ok) return ids.response

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 16 * 1024 })
  if (!parsed.ok) return parsed.response
  const body = parsed.value
  if (!body || !('caption' in body)) return jsonError('caption is required.', 400)

  const updated = await updateSitePhotoCaption({
    orgId: auth.session.orgId,
    jobId: ids.jobId,
    photoId: ids.photoId,
    caption: normalizeCaption(body.caption),
  })
  if ('error' in updated) return jsonError(updated.error ?? 'Unable to update site photo.', updated.status ?? 500)

  return mutationResponse(updated.photo, 'Photo updated.')
}

export async function DELETE(
  request: Request,
  context: { params: { id: string; photoId: string } | Promise<{ id: string; photoId: string }> }
) {
  const auth = await requireSessionUserOrg()
  if (!auth.ok) return auth.response

  const params = await resolveParams(context)
  const ids = validateIds(params?.id, params?.photoId)
  if (!ids.ok) return ids.response

  const deleted = await deleteSitePhoto({
    origin: new URL(request.url).origin,
    orgId: auth.session.orgId,
    userId: auth.session.userId,
    jobId: ids.jobId,
    photoId: ids.photoId,
  })
  if ('error' in deleted) return jsonError(deleted.error ?? 'Unable to delete site photo.', deleted.status ?? 500)
  return mutationResponse(true, 'Photo deleted.')
}
