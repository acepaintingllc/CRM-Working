import {
  jsonError,
  readUuidParam,
  requireSessionUserOrg,
  resolveParams,
} from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import {
  uploadManualQuotePdf,
  type ManualQuotePdfUploadFile,
} from '@/lib/jobs/manualQuoteUpload'

type RouteContext = { params: { id: string } | Promise<{ id: string }> }
type FileLike = {
  name: string
  size: number
  type?: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

function isFileLike(entry: unknown): entry is FileLike {
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

async function readJobId(context: RouteContext) {
  const params = await resolveParams(context)
  return readUuidParam((params as { id?: string } | null | undefined)?.id, 'job id')
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

  const entry = formData.get('pdf')
  if (!isFileLike(entry)) {
    return jsonError('Upload a PDF before continuing.', 400)
  }

  const file: ManualQuotePdfUploadFile = {
    buffer: await entry.arrayBuffer(),
    originalName: entry.name,
    mimeType: typeof entry.type === 'string' ? entry.type : '',
    sizeBytes: entry.size,
  }

  return serviceResultResponse(
    await uploadManualQuotePdf({
      origin: new URL(request.url).origin,
      orgId: session.session.orgId,
      userId: session.session.userId,
      jobId: jobId.value,
      file,
    }),
    (data) => ({ data, notice: 'Manual PDF quote uploaded.' })
  )
}
