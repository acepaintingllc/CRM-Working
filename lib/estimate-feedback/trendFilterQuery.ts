import type {
  EstimateFeedbackTrendFilters,
  EstimateFeedbackTrendOccupancy,
} from '@/types/estimate-feedback/trends'

export type EstimateFeedbackTrendFilterKey = keyof EstimateFeedbackTrendFilters

type TrendFilterSearchParams = Pick<URLSearchParams, 'get' | 'getAll'>

const emptyTags: string[] = []

export const estimateFeedbackTrendFilterQueryAliases = {
  from: ['from', 'start', 'lockedFrom'],
  to: ['to', 'end', 'lockedTo'],
  jobType: ['jobType', 'job_type'],
  occupancy: ['occupancy'],
  conditionTags: [
    'conditionTag',
    'conditionTags',
    'condition_tag',
    'condition_tags',
  ],
  maxAbsoluteVariance: ['maxAbsoluteVariance', 'max_absolute_variance'],
  maxAbsoluteTotalImpact: [
    'maxAbsoluteTotalImpact',
    'max_absolute_total_impact',
  ],
} as const satisfies Record<EstimateFeedbackTrendFilterKey, readonly string[]>

export const estimateFeedbackTrendFilterCanonicalQueryKeys = {
  from: 'from',
  to: 'to',
  jobType: 'jobType',
  occupancy: 'occupancy',
  conditionTags: 'conditionTag',
  maxAbsoluteVariance: 'maxAbsoluteVariance',
  maxAbsoluteTotalImpact: 'maxAbsoluteTotalImpact',
} as const satisfies Record<EstimateFeedbackTrendFilterKey, string>

export function cleanTrendFilterString(value: string | null | undefined) {
  const next = value?.trim()
  return next || null
}

export function cleanTrendFilterNumberToken(
  value: string | null | undefined
): number | null {
  const next = cleanTrendFilterString(value)
  if (!next) return null

  const parsed = Number(next)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function cleanTrendFilterRawNumberToken(
  value: string | null | undefined
): number | string | null {
  const next = cleanTrendFilterString(value)
  if (!next) return null

  const parsed = Number(next)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : next
}

export function cleanTrendFilterOccupancy(
  value: string | null | undefined
): EstimateFeedbackTrendOccupancy | null {
  const next = cleanTrendFilterString(value)?.toLowerCase()
  return next === 'occupied' || next === 'vacant' ? next : null
}

export function uniqueTrendFilterTags(values: string[]) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

export function readFirstTrendFilterQueryValue(
  searchParams: Pick<URLSearchParams, 'get'>,
  keys: readonly string[]
) {
  for (const key of keys) {
    const value = cleanTrendFilterString(searchParams.get(key))
    if (value) return value
  }
  return null
}

export function readEstimateFeedbackTrendFilterQuery(
  searchParams: TrendFilterSearchParams
): EstimateFeedbackTrendFilters {
  return {
    from: readFirstTrendFilterQueryValue(
      searchParams,
      estimateFeedbackTrendFilterQueryAliases.from
    ),
    to: readFirstTrendFilterQueryValue(
      searchParams,
      estimateFeedbackTrendFilterQueryAliases.to
    ),
    jobType: readFirstTrendFilterQueryValue(
      searchParams,
      estimateFeedbackTrendFilterQueryAliases.jobType
    ),
    occupancy: cleanTrendFilterOccupancy(
      readFirstTrendFilterQueryValue(
        searchParams,
        estimateFeedbackTrendFilterQueryAliases.occupancy
      )
    ),
    conditionTags: uniqueTrendFilterTags(
      estimateFeedbackTrendFilterQueryAliases.conditionTags.flatMap((key) =>
        searchParams.getAll(key)
      )
    ),
    maxAbsoluteVariance: cleanTrendFilterNumberToken(
      readFirstTrendFilterQueryValue(
        searchParams,
        estimateFeedbackTrendFilterQueryAliases.maxAbsoluteVariance
      )
    ),
    maxAbsoluteTotalImpact: cleanTrendFilterNumberToken(
      readFirstTrendFilterQueryValue(
        searchParams,
        estimateFeedbackTrendFilterQueryAliases.maxAbsoluteTotalImpact
      )
    ),
  }
}

export function readEstimateFeedbackTrendFilterRawQuery(
  searchParams: TrendFilterSearchParams
): EstimateFeedbackTrendFilters {
  return {
    from: readFirstTrendFilterQueryValue(
      searchParams,
      estimateFeedbackTrendFilterQueryAliases.from
    ),
    to: readFirstTrendFilterQueryValue(
      searchParams,
      estimateFeedbackTrendFilterQueryAliases.to
    ),
    jobType: readFirstTrendFilterQueryValue(
      searchParams,
      estimateFeedbackTrendFilterQueryAliases.jobType
    ),
    occupancy: readFirstTrendFilterQueryValue(
      searchParams,
      estimateFeedbackTrendFilterQueryAliases.occupancy
    ),
    conditionTags: uniqueTrendFilterTags(
      estimateFeedbackTrendFilterQueryAliases.conditionTags.flatMap((key) =>
        searchParams.getAll(key)
      )
    ),
    maxAbsoluteVariance: cleanTrendFilterRawNumberToken(
      readFirstTrendFilterQueryValue(
        searchParams,
        estimateFeedbackTrendFilterQueryAliases.maxAbsoluteVariance
      )
    ),
    maxAbsoluteTotalImpact: cleanTrendFilterRawNumberToken(
      readFirstTrendFilterQueryValue(
        searchParams,
        estimateFeedbackTrendFilterQueryAliases.maxAbsoluteTotalImpact
      )
    ),
  }
}

export function updateEstimateFeedbackTrendFilterQueryValue(
  filters: EstimateFeedbackTrendFilters,
  key: EstimateFeedbackTrendFilterKey,
  value: string
): EstimateFeedbackTrendFilters {
  if (key === 'conditionTags') {
    return {
      ...filters,
      conditionTags: uniqueTrendFilterTags(value.split(',')),
    }
  }

  if (key === 'maxAbsoluteVariance' || key === 'maxAbsoluteTotalImpact') {
    return {
      ...filters,
      [key]: cleanTrendFilterNumberToken(value),
    }
  }

  if (key === 'occupancy') {
    return {
      ...filters,
      occupancy: cleanTrendFilterOccupancy(value),
    }
  }

  return {
    ...filters,
    [key]: cleanTrendFilterString(value),
  }
}

export function buildEstimateFeedbackTrendFilterSearchParams(
  filters?: EstimateFeedbackTrendFilters | null
) {
  const search = new URLSearchParams()
  const from = cleanTrendFilterString(filters?.from)
  const to = cleanTrendFilterString(filters?.to)
  const jobType = cleanTrendFilterString(filters?.jobType)
  const occupancy = cleanTrendFilterOccupancy(filters?.occupancy)

  if (from) search.set(estimateFeedbackTrendFilterCanonicalQueryKeys.from, from)
  if (to) search.set(estimateFeedbackTrendFilterCanonicalQueryKeys.to, to)
  if (jobType) {
    search.set(estimateFeedbackTrendFilterCanonicalQueryKeys.jobType, jobType)
  }
  if (occupancy) {
    search.set(estimateFeedbackTrendFilterCanonicalQueryKeys.occupancy, occupancy)
  }
  if (filters?.maxAbsoluteVariance != null) {
    const value = cleanTrendFilterNumberToken(String(filters.maxAbsoluteVariance))
    if (value != null) {
      search.set(
        estimateFeedbackTrendFilterCanonicalQueryKeys.maxAbsoluteVariance,
        String(value)
      )
    }
  }
  if (filters?.maxAbsoluteTotalImpact != null) {
    const value = cleanTrendFilterNumberToken(String(filters.maxAbsoluteTotalImpact))
    if (value != null) {
      search.set(
        estimateFeedbackTrendFilterCanonicalQueryKeys.maxAbsoluteTotalImpact,
        String(value)
      )
    }
  }

  for (const tag of filters?.conditionTags ?? emptyTags) {
    const conditionTag = cleanTrendFilterString(tag)
    if (conditionTag) {
      search.append(
        estimateFeedbackTrendFilterCanonicalQueryKeys.conditionTags,
        conditionTag
      )
    }
  }

  return search
}

export function buildEstimateFeedbackTrendFilterPath(
  filters?: EstimateFeedbackTrendFilters | null,
  pathname = '/api/insights/trends'
) {
  const query = buildEstimateFeedbackTrendFilterSearchParams(filters).toString()
  return query ? `${pathname}?${query}` : pathname
}
