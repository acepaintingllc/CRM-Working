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
type FileLike = {
  name: string
  size: number
  type?: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

async function readJobId(context: RouteContext) {
  const params = await resolveParams(context)
  return readUuidParam((params as { id?: string } | null | undefined)?.id, 'job id')
}

function readIndexedString(values: FormDataEntryValue[], index: number): string | null {
  const value = values[index]
  return typeof value === 'string' && value.trim() ? value : null
}

function isFileLike(entry: FormDataEntryValue): entry is FileLike {
  if (typeof File !== 'undefined' && entry instanceof File) return true
  if (!entry || typeof entry !== 'object') return false
  const candidate = entry as Partial<FileLike>
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.size === 'number' &&
    typeof candidate.arrayBuffer === 'function' &&
    (candidate.type === undefined || typeof candidate.type === 'string')
  )
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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError('Invalid multipart form data.', 400)
  }

  const categoryValue = formData.get('category')
  const category = typeof categoryValue === 'string' ? categoryValue : null
  const photoEntries = formData.getAll('photos').filter(isFileLike)
  if (photoEntries.length === 0) {
    return jsonError('Add at least one photo before uploading.', 400)
  }

  const clientLocalIds = formData.getAll('clientLocalId')
  const capturedAtValues = formData.getAll('capturedAt')
  const files: JobSitePhotoUploadFile[] = []
  for (let index = 0; index < photoEntries.length; index += 1) {
    const file = photoEntries[index]
    files.push({
      buffer: await file.arrayBuffer(),
      originalName: file.name,
      mimeType: typeof file.type === 'string' ? file.type : '',
      sizeBytes: file.size,
      clientLocalId: readIndexedString(clientLocalIds, index),
      capturedAt: readIndexedString(capturedAtValues, index),
    })
  }

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
