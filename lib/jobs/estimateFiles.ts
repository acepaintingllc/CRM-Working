import { findLatestEstimateFile, findMatchingEstimateFiles } from '@/lib/server/googleDrive'
import { supabaseAdmin } from '@/lib/server/org'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import type { EstimateDriveFile } from '@/types/jobs/api'

type JobRecord = { customer_id: string | null }
type CustomerRecord = { address: string | null }

export type JobEstimateFilesResult = {
  latest: EstimateDriveFile | null
  files: EstimateDriveFile[]
}

export type ResolvedJobEstimateSelection = {
  latest: EstimateDriveFile | null
  files: EstimateDriveFile[]
}

const ESTIMATE_TO_QUOTE_MESSAGES = new Map<string, string>([
  ['No matching estimate PDF found in Drive folder.', 'No matching quote PDF found in Drive folder.'],
  ['No matching estimate file found in Drive folder.', 'No matching quote file found in Drive folder.'],
  [
    'One or more selected estimate attachments are no longer available.',
    'One or more selected quote attachments are no longer available.',
  ],
  ['Select at least one matching estimate attachment.', 'Select at least one matching quote attachment.'],
])

function quoteFacingEstimateFileMessage(message: string | null | undefined, fallback: string) {
  if (typeof message !== 'string') return fallback
  const trimmed = message.trim()
  if (!trimmed) return fallback
  return ESTIMATE_TO_QUOTE_MESSAGES.get(trimmed) ?? trimmed
}

async function loadJobCustomerAddress(orgId: string, jobId: string): Promise<ServiceResult<string>> {
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, customer_id')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (jobError) return errorResult('server_error', 'Unable to load job.')
  if (!job) return errorResult('not_found', 'Job not found')

  const jobRow = job as JobRecord
  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('address')
    .eq('org_id', orgId)
    .eq('id', jobRow.customer_id)
    .maybeSingle()

  if (customerError) return errorResult('server_error', 'Unable to load customer.')

  const address = (customer as CustomerRecord | null)?.address
  if (!address) return errorResult('invalid_input', 'Customer address missing.')

  return okResult(address)
}

export async function getLatestJobEstimateFile(params: {
  origin: string
  orgId: string
  userId: string
  jobId: string
}): Promise<ServiceResult<EstimateDriveFile>> {
  const address = await loadJobCustomerAddress(params.orgId, params.jobId)
  if (!address.ok) return address

  const result = await findLatestEstimateFile({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    address: address.data,
  })

  if ('error' in result) {
    return errorResult(
      'not_found',
      quoteFacingEstimateFileMessage(result.error, 'No matching quote PDF found in Drive folder.')
    )
  }

  return okResult(result.file)
}

export async function listMatchingJobEstimateFiles(params: {
  origin: string
  orgId: string
  userId: string
  jobId: string
}): Promise<ServiceResult<JobEstimateFilesResult>> {
  const address = await loadJobCustomerAddress(params.orgId, params.jobId)
  if (!address.ok) return address

  const result = await findMatchingEstimateFiles({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    address: address.data,
  })

  if ('error' in result) {
    return errorResult(
      'not_found',
      quoteFacingEstimateFileMessage(result.error, 'No matching quote file found in Drive folder.')
    )
  }

  const latest = result.files[0] ?? null
  return okResult({ latest, files: result.files })
}

export function selectJobEstimateFiles(
  matching: JobEstimateFilesResult,
  estimateFileIds: readonly string[]
): ServiceResult<ResolvedJobEstimateSelection> {
  if (estimateFileIds.length === 0) {
    const latest = matching.latest ?? matching.files[0] ?? null
    if (!latest) {
      return errorResult('invalid_input', 'No matching quote file found in Drive folder.')
    }
    return okResult({ latest, files: [latest] })
  }

  const byId = new Map(matching.files.map((file) => [file.id, file]))
  const files = estimateFileIds
    .map((fileId) => byId.get(fileId) ?? null)
    .filter((file): file is EstimateDriveFile => Boolean(file))

  if (files.length !== estimateFileIds.length) {
    return errorResult(
      'invalid_input',
      'One or more selected quote attachments are no longer available.'
    )
  }

  if (files.length === 0) {
    return errorResult('invalid_input', 'Select at least one matching quote attachment.')
  }

  return okResult({
    latest: matching.latest ?? files[0] ?? null,
    files,
  })
}

export async function resolveJobEstimateFiles(params: {
  origin: string
  orgId: string
  userId: string
  jobId: string
  estimateFileIds: readonly string[]
}): Promise<ServiceResult<ResolvedJobEstimateSelection>> {
  const matching = await listMatchingJobEstimateFiles(params)
  if (!matching.ok) return matching
  return selectJobEstimateFiles(matching.data, params.estimateFileIds)
}
