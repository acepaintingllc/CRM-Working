export const QUOTE_VERSION_KINDS = [
  'standard',
  'alternate',
  'split',
  'combined',
  'revision',
] as const

export type QuoteVersionKind = (typeof QUOTE_VERSION_KINDS)[number]

export const QUOTE_VERSION_KIND_OPTIONS: ReadonlyArray<{
  value: QuoteVersionKind
  label: string
}> = [
  { value: 'standard', label: 'Standard' },
  { value: 'alternate', label: 'Alternate' },
  { value: 'split', label: 'Split' },
  { value: 'combined', label: 'Combined' },
  { value: 'revision', label: 'Revision' },
]

export const QUOTE_VERSION_REQUIRED_JOB_ERROR = 'Select a job before creating a version.'
export const QUOTE_VERSION_INVALID_KIND_ERROR = 'Choose a valid version kind.'
export const QUOTE_VERSION_CREATE_ERROR = 'Failed to create quote.'

const QUOTE_VERSION_KIND_SET = new Set<string>(QUOTE_VERSION_KINDS)

export type QuoteVersionCreationJob = {
  id: string
  customer_id: string | null
}

export type EligibleQuoteVersionJob<T extends QuoteVersionCreationJob = QuoteVersionCreationJob> = Omit<
  T,
  'customer_id'
> & {
  customer_id: string
}

export type QuoteVersionRecord = {
  job_id: string
  updated_at: string | null
}

export type CreateQuoteVersionDraft = {
  versionKind: string | null | undefined
  versionName: string
}

export type CreateQuoteVersionInput = {
  job_id: string
  customer_id: string
  version_kind: QuoteVersionKind
  version_name?: string
}

export type CreateQuoteVersionInputResult =
  | {
      ok: true
      input: CreateQuoteVersionInput
      error: null
    }
  | {
      ok: false
      input: null
      error: string
    }

function asTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export function isQuoteVersionKind(value: string | null | undefined): value is QuoteVersionKind {
  return QUOTE_VERSION_KIND_SET.has(String(value ?? '').trim().toLowerCase())
}

export function normalizeQuoteVersionKind(value: string | null | undefined): QuoteVersionKind {
  const normalized = String(value ?? '').trim().toLowerCase()
  return isQuoteVersionKind(normalized) ? normalized : 'standard'
}

export function isEligibleQuoteVersionJob(
  job: QuoteVersionCreationJob | null | undefined
): job is EligibleQuoteVersionJob {
  return Boolean(job?.id && String(job.customer_id ?? '').trim())
}

export function filterEligibleQuoteVersionJobs<T extends QuoteVersionCreationJob>(
  jobs: T[]
): Array<EligibleQuoteVersionJob<T>> {
  return jobs.filter((job) => isEligibleQuoteVersionJob(job)) as Array<EligibleQuoteVersionJob<T>>
}

export function deriveQuoteVersionsForJob<T extends QuoteVersionRecord>(versions: T[], jobId: string) {
  if (!jobId) return [] as T[]
  return versions
    .filter((version) => version.job_id === jobId)
    .sort((a, b) => asTimestamp(b.updated_at) - asTimestamp(a.updated_at))
}

export function buildDefaultQuoteVersionName(versionSortOrder: number | null | undefined) {
  const normalizedSortOrder =
    typeof versionSortOrder === 'number' && Number.isFinite(versionSortOrder)
      ? Math.max(0, Math.trunc(versionSortOrder))
      : 0
  return `Quote Version ${normalizedSortOrder + 1}`
}

export function buildCreateQuoteVersionInput(
  job: EligibleQuoteVersionJob,
  draft: CreateQuoteVersionDraft
): CreateQuoteVersionInput {
  const versionName = draft.versionName.trim()
  return {
    job_id: job.id,
    customer_id: job.customer_id,
    version_kind: normalizeQuoteVersionKind(draft.versionKind),
    ...(versionName ? { version_name: versionName } : {}),
  }
}

export function prepareCreateQuoteVersionInput(
  job: QuoteVersionCreationJob | null | undefined,
  draft: CreateQuoteVersionDraft
): CreateQuoteVersionInputResult {
  if (!isEligibleQuoteVersionJob(job)) {
    return {
      ok: false,
      input: null,
      error: QUOTE_VERSION_REQUIRED_JOB_ERROR,
    }
  }

  if (!isQuoteVersionKind(draft.versionKind)) {
    return {
      ok: false,
      input: null,
      error: QUOTE_VERSION_INVALID_KIND_ERROR,
    }
  }

  return {
    ok: true,
    input: buildCreateQuoteVersionInput(job, {
      versionKind: normalizeQuoteVersionKind(draft.versionKind),
      versionName: draft.versionName,
    }),
    error: null,
  }
}

export function getQuoteWorkspaceHref(estimateId: string) {
  return `/crm/quotes/${estimateId}`
}
