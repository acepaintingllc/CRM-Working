import {
  jsonError,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import {
  listJobSitePhotos,
  uploadJobSitePhotos,
  type JobSitePhotoUploadFile,
} from '@/lib/jobs/sitePhotos'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

async function readJobId(context: RouteContext) {
  const params = await resolveParams(context)
  return readUuidParam((params as { id?: string } | null | undefined)?.id, 'job id')
}

function readIndexedString(values: FormDataEntryValue[], index: number): string | null {
  const value = values[index]
  return typeof value === 'string' && value.trim() ? value : null
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobId(context)
  if (!jobId.ok) return jobId.response

  return serviceResultResponse(
    await listJobSitePhotos(session.session.orgId, jobId.value),
    (data) => ({ data })
  )
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response

  const jobId = await readJobId(context)
  if (!jobId.ok) return jobId.response

  const formData = await request.formData()
  const category = formData.get('category')
  const photoEntries = formData.getAll('photos').filter((entry): entry is File => entry instanceof File)
  if (photoEntries.length === 0) {
    return jsonError('Add at least one photo before uploading.', 400)
  }

  const clientLocalIds = formData.getAll('clientLocalId')
  const capturedAtValues = formData.getAll('capturedAt')
  const files: JobSitePhotoUploadFile[] = await Promise.all(
    photoEntries.map(async (file, index) => ({
      buffer: await file.arrayBuffer(),
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      clientLocalId: readIndexedString(clientLocalIds, index),
      capturedAt: readIndexedString(capturedAtValues, index),
    }))
  )

  return serviceResultResponse(
    await uploadJobSitePhotos({
      origin: new URL(request.url).origin,
      orgId: session.session.orgId,
      userId: session.session.userId,
      jobId: jobId.value,
      category,
      files,
    }),
    (data) => ({ data, notice: 'Photos uploaded.' })
  )
}
