import type {
  JobReviewDataQualityStatus,
  JobReviewMetricRecord,
  JobReviewPrimaryCauseTag,
  JobReviewReadModel,
  JobReviewStatus,
} from '@/types/jobs/feedback'
import {
  areJobReviewFormStatesEqual,
  buildJobReviewFormState,
  jobReviewClassificationOptions,
  type JobReviewFormState,
} from '@/lib/estimate-feedback/forms'
import type { JobDetail } from '@/types/jobs/api'

export type JobReviewMetricVm = {
  key: string
  label: string
  estimate: string
  actual: string
  variance: string
  variancePercent: string
  totalImpact: string
  tone: 'success' | 'warning'
  withinToleranceLabel: string
}

export type JobReviewVm = {
  estimateSnapshotId: string
  versionName: string
  acceptedAt: string
  finalTotal: string
  statusLabel: string
  statusTone: 'default' | 'accent' | 'success' | 'warning'
  isLocked: boolean
  isReviewed: boolean
  hasUnsavedChanges: boolean
  hasUnsavedTrendEligibilityChanges: boolean
  trendEligibilityDetail: string
  trendEligibleLabel: string
  trendEligibleTone: 'success' | 'warning' | 'default'
  dataQualityLabel: string
  dataQualityTone: 'success' | 'warning' | 'default'
  exclusionLabel: string
  exclusionTone: 'warning' | 'default'
  changeOrderLabel: string
  changeOrderTone: 'warning' | 'default'
  lockedAt: string | null
  reviewedAt: string | null
  classificationOptions: {
    causeTags: readonly { value: JobReviewPrimaryCauseTag; label: string }[]
    dataQuality: readonly { value: JobReviewDataQualityStatus; label: string }[]
  }
  kpis: Array<{ id: string; label: string; value: string; detail: string }>
  metrics: JobReviewMetricVm[]
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function toNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function formatNumber(value: number, suffix = '') {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)
  return suffix ? `${formatted} ${suffix}` : formatted
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateTimeFormatter.format(date)
}

function metricFormatter(metric: Pick<JobReviewMetricRecord, 'unit'>) {
  if (metric.unit === 'currency') return formatCurrency
  if (metric.unit === 'hours') return (value: number) => formatNumber(value, 'hr')
  return (value: number) => formatNumber(value, 'gal')
}

function signed(value: number, formatter: (value: number) => string) {
  if (value === 0) return formatter(0)
  return `${value > 0 ? '+' : ''}${formatter(value)}`
}

function formatPercent(value: number | null) {
  if (value === null) return 'No estimate baseline'
  return signed(value, (next) => `${formatNumber(next)}%`)
}

function statusLabel(status: JobReviewStatus) {
  if (status === 'locked') return 'Locked'
  if (status === 'reviewed') return 'Reviewed'
  return 'Draft'
}

function statusTone(status: string): JobReviewVm['statusTone'] {
  if (status === 'locked') return 'success'
  if (status === 'reviewed') return 'accent'
  return 'warning'
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function dataQualityTone(
  value: JobReviewDataQualityStatus
): JobReviewVm['dataQualityTone'] {
  if (value === 'valid') return 'success'
  if (value === 'invalid') return 'warning'
  return 'default'
}

function fallbackTrendEligibilityPreview() {
  return {
    included: {
      valid: false,
      questionable: false,
      invalid: false,
    },
    excluded: {
      valid: false,
      questionable: false,
      invalid: false,
    },
  }
}

function trendEligibilityFormValuesEqual(
  left: JobReviewFormState,
  right: JobReviewFormState
) {
  return (
    left.data_quality_status === right.data_quality_status &&
    left.exclude_from_trends === right.exclude_from_trends
  )
}

export function buildJobReviewVm(params: {
  job: JobDetail | null
  model: JobReviewReadModel | null
  form?: JobReviewFormState
}): JobReviewVm | null {
  const acceptedQuote = params.job?.accepted_quote ?? null
  if (!acceptedQuote?.estimate_snapshot_id || !params.model) return null

  const review = params.model.review
  const status = review?.status ?? 'draft'
  const savedForm = buildJobReviewFormState(params.model)
  const form = params.form ?? savedForm
  const dataQuality = form.data_quality_status
  const excluded = form.exclude_from_trends
  const changeOrderPresent = form.change_order_present
  const trendEligibilityPreview =
    params.model.trend_eligibility_preview ?? fallbackTrendEligibilityPreview()
  const previewTrendEligible =
    trendEligibilityPreview[excluded ? 'excluded' : 'included'][dataQuality]
  const savedTrendEligible = params.model.trend_eligible
  const hasUnsavedChanges = !areJobReviewFormStatesEqual(form, savedForm)
  const hasUnsavedTrendEligibilityChanges = !trendEligibilityFormValuesEqual(form, savedForm)
  const metrics = params.model.metrics.map((metric) => {
    const formatter = metricFormatter(metric)
    const tone: JobReviewMetricVm['tone'] = metric.within_tolerance ? 'success' : 'warning'
    return {
      key: metric.metric_key,
      label: metric.metric_label,
      estimate: formatter(toNumber(metric.estimated_value)),
      actual: formatter(toNumber(metric.actual_value)),
      variance: signed(toNumber(metric.variance_value), formatter),
      variancePercent: formatPercent(metric.variance_percent),
      totalImpact: signed(toNumber(metric.total_impact), formatCurrency),
      tone,
      withinToleranceLabel: metric.within_tolerance ? 'Within tolerance' : 'Outside tolerance',
    }
  })

  const largestVariance = [...metrics].sort((left, right) => {
    const leftRaw = params.model?.metrics.find((metric) => metric.metric_key === left.key)
    const rightRaw = params.model?.metrics.find((metric) => metric.metric_key === right.key)
    return Math.abs(toNumber(rightRaw?.total_impact)) - Math.abs(toNumber(leftRaw?.total_impact))
  })[0]
  const outsideTolerance = metrics.filter((metric) => metric.tone === 'warning').length

  return {
    estimateSnapshotId: acceptedQuote.estimate_snapshot_id,
    versionName: acceptedQuote.version_name ?? 'Accepted estimate',
    acceptedAt: formatDateTime(acceptedQuote.accepted_at) ?? '-',
    finalTotal: formatCurrency(toNumber(acceptedQuote.final_total)),
    statusLabel: statusLabel(status),
    statusTone: statusTone(status),
    isLocked: status === 'locked',
    isReviewed: status === 'reviewed' || status === 'locked',
    hasUnsavedChanges,
    hasUnsavedTrendEligibilityChanges,
    trendEligibilityDetail: hasUnsavedTrendEligibilityChanges
      ? 'Unsaved form changes affect trend eligibility.'
      : savedTrendEligible
        ? 'Current saved review is included in trends.'
        : previewTrendEligible
          ? 'Current form can be included after locking.'
          : 'Current form is excluded from trends.',
    trendEligibleLabel: savedTrendEligible
      ? 'Trend eligible'
      : previewTrendEligible
        ? 'Eligible when locked'
        : 'Not trend eligible',
    trendEligibleTone: savedTrendEligible
      ? 'success'
      : previewTrendEligible
        ? 'default'
        : excluded || dataQuality === 'invalid' || dataQuality === 'questionable'
        ? 'warning'
        : 'default',
    dataQualityLabel: `Quality: ${titleCase(dataQuality)}`,
    dataQualityTone: dataQualityTone(dataQuality),
    exclusionLabel: excluded ? 'Excluded from trends' : 'Included if locked',
    exclusionTone: excluded ? 'warning' : 'default',
    changeOrderLabel: changeOrderPresent ? 'Change order present' : 'No change order',
    changeOrderTone: changeOrderPresent ? 'warning' : 'default',
    lockedAt: formatDateTime(review?.locked_at),
    reviewedAt: formatDateTime(review?.reviewed_at),
    classificationOptions: jobReviewClassificationOptions,
    kpis: [
      {
        id: 'quote-total',
        label: 'Quote total',
        value: formatCurrency(toNumber(acceptedQuote.final_total)),
        detail: 'Accepted snapshot',
      },
      {
        id: 'largest-variance',
        label: 'Largest variance',
        value: largestVariance?.totalImpact ?? '-',
        detail: largestVariance?.label ?? 'No metrics',
      },
      {
        id: 'outside-tolerance',
        label: 'Outside tolerance',
        value: String(outsideTolerance),
        detail: `${metrics.length} metrics reviewed`,
      },
      {
        id: 'data-quality',
        label: 'Data quality',
        value: dataQuality,
        detail: savedTrendEligible ? 'Included in trends' : 'Review controls trends',
      },
    ],
    metrics,
  }
}
