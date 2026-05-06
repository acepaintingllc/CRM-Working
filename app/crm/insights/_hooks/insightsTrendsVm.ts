import type {
  EstimateFeedbackTrendMetricSummary,
  EstimateFeedbackTrendSummary,
} from '@/types/estimate-feedback/trends'
import type {
  TrendRecommendationConfidence,
  TrendRecommendationRecord,
} from '@/types/estimate-feedback/recommendations'
import type { CrmChipTone } from '@/app/crm/_components/crmStyles'

type TrendMetricKey = keyof EstimateFeedbackTrendSummary['metrics']

type KpiVm = {
  id: string
  label: string
  value: string
  detail: string
  badge: string
  tone: CrmChipTone
}

type VarianceRowVm = {
  id: TrendMetricKey
  label: string
  description: string
  averageVariance: string
  averageImpact: string
  countLabel: string
  tone: CrmChipTone
}

type PatternVm = {
  id: string
  label: string
  countLabel: string
  averageVariance: string
  averageImpact: string
  totalImpact: string
  tone: CrmChipTone
}

type RecommendationCardVm = {
  id: string
  title: string
  targetSettingKey: string
  currentValue: string
  suggestedValue: string
  confidenceLabel: string
  confidenceTone: CrmChipTone
  evidence: string[]
  reason: string
  basedOnJobCountLabel: string
  isPending: boolean
  applyLabel: string
  dismissLabel: string
}

export type InsightsTrendsPageVm = {
  kpis: KpiVm[]
  varianceRows: VarianceRowVm[]
  patterns: PatternVm[]
  recommendations: RecommendationCardVm[]
  recommendationCountLabel: string
  recommendationGenerateLabel: string
  recommendationsGenerating: boolean
  applyConfirmation: {
    isOpen: boolean
    description: string
    info: string | null
    confirming: boolean
  }
  jobsAnalyzedLabel: string
  hasMetrics: boolean
}

type RecommendationActionState = {
  pendingId?: string | null
  pendingAction?: 'apply' | 'dismiss' | null
  generating?: boolean
  confirmingApplyId?: string | null
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const metricLabels: Record<
  TrendMetricKey,
  { label: string; description: string; unit: 'hr' | 'gal' | 'currency' }
> = {
  labor: {
    label: 'Labor',
    description: 'Average labor-hour miss across locked reviews.',
    unit: 'hr',
  },
  paint: {
    label: 'Paint',
    description: 'Average paint-gallon miss across locked reviews.',
    unit: 'gal',
  },
  supplies: {
    label: 'Supplies',
    description: 'Average supply-cost miss across locked reviews.',
    unit: 'currency',
  },
}

function formatSigned(value: number | null, formatter: (value: number) => string) {
  if (value === null) return '-'
  const formatted = formatter(value)
  return value > 0 ? `+${formatted}` : formatted
}

function formatUnit(value: number | null, unit: 'hr' | 'gal' | 'currency') {
  if (unit === 'currency') return formatSigned(value, currencyFormatter.format)
  return formatSigned(value, (next) => `${numberFormatter.format(next)} ${unit}`)
}

function formatCurrency(value: number | null) {
  if (value === null) return '-'
  return formatSigned(value, currencyFormatter.format)
}

function formatPatternVariance(key: string, value: number | null) {
  const metricKey = key as TrendMetricKey
  const config = metricLabels[metricKey]
  if (config) return formatUnit(value, config.unit)
  if (value === null) return '-'
  return formatSigned(value, numberFormatter.format)
}

function toneForValue(value: number | null): CrmChipTone {
  if (value === null || value === 0) return 'default'
  return value > 0 ? 'warning' : 'success'
}

function confidenceTone(confidence: TrendRecommendationConfidence): CrmChipTone {
  if (confidence === 'high') return 'success'
  if (confidence === 'medium') return 'warning'
  return 'default'
}

function titleCase(value: string) {
  return value
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') return numberFormatter.format(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(formatJsonValue).join(', ')
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${titleCase(key)}: ${formatJsonValue(nestedValue)}`)
      .join(', ')
  }
  return String(value)
}

function formatValueJson(value: Record<string, unknown>) {
  const entries = Object.entries(value)
  if (entries.length === 0) return '-'
  return entries
    .map(([key, entryValue]) => `${titleCase(key)}: ${formatJsonValue(entryValue)}`)
    .join(', ')
}

function buildEvidenceItems(recommendation: TrendRecommendationRecord) {
  const evidenceItems = Object.entries(recommendation.evidence_json).map(
    ([key, value]) => `${titleCase(key)}: ${formatJsonValue(value)}`
  )

  return evidenceItems.length > 0 ? evidenceItems : ['No evidence details were stored.']
}

function metricCount(metrics: Record<TrendMetricKey, EstimateFeedbackTrendMetricSummary>) {
  return Object.values(metrics).reduce((count, metric) => count + metric.count, 0)
}

function buildRecommendationCardVm(
  recommendation: TrendRecommendationRecord,
  actionState: RecommendationActionState
): RecommendationCardVm {
  const pendingAction =
    actionState.pendingId === recommendation.id ? actionState.pendingAction ?? null : null
  const isConfirming = actionState.confirmingApplyId === recommendation.id
  const isPending = Boolean(pendingAction) || isConfirming

  return {
    id: recommendation.id,
    title: titleCase(recommendation.target_setting_key),
    targetSettingKey: recommendation.target_setting_key,
    currentValue: formatValueJson(recommendation.current_value_json),
    suggestedValue: formatValueJson(recommendation.suggested_value_json),
    confidenceLabel: titleCase(recommendation.confidence_label),
    confidenceTone: confidenceTone(recommendation.confidence_label),
    evidence: buildEvidenceItems(recommendation),
    reason: recommendation.reason,
    basedOnJobCountLabel: `${recommendation.based_on_job_count} jobs`,
    isPending,
    applyLabel: pendingAction === 'apply' ? 'Applying' : 'Apply',
    dismissLabel: pendingAction === 'dismiss' ? 'Dismissing' : 'Dismiss',
  }
}

export function buildInsightsTrendsPageVm(
  summary: EstimateFeedbackTrendSummary,
  recommendations: TrendRecommendationRecord[] = [],
  actionState: RecommendationActionState = {}
): InsightsTrendsPageVm {
  const openRecommendations = recommendations.filter(
    (recommendation) => recommendation.status === 'open'
  )
  const recommendationCards = openRecommendations.map((recommendation) =>
    buildRecommendationCardVm(recommendation, actionState)
  )
  const confirmingApplyCard =
    recommendationCards.find((card) => card.id === actionState.confirmingApplyId) ?? null
  const confirmingApply =
    actionState.pendingId === actionState.confirmingApplyId &&
    actionState.pendingAction === 'apply'
  const varianceRows = (Object.keys(summary.metrics) as TrendMetricKey[]).map((key) => {
    const metric = summary.metrics[key]
    const config = metricLabels[key]

    return {
      id: key,
      label: config.label,
      description: config.description,
      averageVariance: formatUnit(metric.averageVariance, config.unit),
      averageImpact: formatCurrency(metric.averageTotalImpact),
      countLabel: `${metric.count} metrics`,
      tone: toneForValue(metric.averageTotalImpact),
    }
  })

  return {
    kpis: [
      {
        id: 'jobs-analyzed',
        label: 'Jobs analyzed',
        value: numberFormatter.format(summary.jobsAnalyzed),
        detail: 'Locked, valid reviews included by the selected filters.',
        badge: 'Sample',
        tone: summary.jobsAnalyzed > 0 ? 'accent' : 'default',
      },
      {
        id: 'average-miss',
        label: 'Average miss per job',
        value: formatCurrency(summary.averageMissPerJob),
        detail: 'Portfolio-level miss averaged by eligible job.',
        badge: 'Per job',
        tone: toneForValue(summary.averageMissPerJob),
      },
      {
        id: 'portfolio-impact',
        label: 'Portfolio impact',
        value: formatCurrency(summary.portfolioImpact),
        detail: 'Total impact across jobs in the current trend set.',
        badge: 'Total',
        tone: toneForValue(summary.portfolioImpact),
      },
      {
        id: 'labor-variance',
        label: 'Avg labor variance',
        value: formatUnit(summary.averageLaborVariance, 'hr'),
        detail: 'Labor-hour variance returned by the trend service.',
        badge: 'Labor',
        tone: toneForValue(summary.averageLaborVariance),
      },
    ],
    varianceRows,
    patterns: summary.patterns.map((pattern) => ({
      id: pattern.key,
      label: pattern.label,
      countLabel: `${pattern.count} metrics`,
      averageVariance: formatPatternVariance(pattern.key, pattern.averageVariance),
      averageImpact: formatCurrency(pattern.averageTotalImpact),
      totalImpact: formatCurrency(pattern.totalImpact),
      tone: toneForValue(pattern.totalImpact),
    })),
    recommendations: recommendationCards,
    recommendationCountLabel: `${openRecommendations.length} open`,
    recommendationGenerateLabel: actionState.generating ? 'Generating' : 'Generate recommendations',
    recommendationsGenerating: Boolean(actionState.generating),
    applyConfirmation: {
      isOpen: Boolean(confirmingApplyCard),
      description: confirmingApplyCard
        ? `Apply ${confirmingApplyCard.title} to estimator settings.`
        : 'Apply this recommendation to estimator settings.',
      info: confirmingApplyCard
        ? `Target: ${confirmingApplyCard.targetSettingKey}. Current value: ${confirmingApplyCard.currentValue}. Suggested value: ${confirmingApplyCard.suggestedValue}.`
        : null,
      confirming: confirmingApply,
    },
    jobsAnalyzedLabel: `${summary.jobsAnalyzed} jobs analyzed`,
    hasMetrics: metricCount(summary.metrics) > 0,
  }
}
