export type EstimateFeedbackTrendOccupancy = 'occupied' | 'vacant'

export type EstimateFeedbackTrendFilters = {
  from?: string | null
  to?: string | null
  jobType?: string | null
  occupancy?: EstimateFeedbackTrendOccupancy | null
  conditionTags?: string[] | null
  maxAbsoluteVariance?: number | null
  maxAbsoluteTotalImpact?: number | null
}

export type EstimateFeedbackTrendResolvedFilters = {
  from: string | null
  to: string | null
  jobType: string | null
  occupancy: EstimateFeedbackTrendOccupancy | null
  conditionTags: string[]
  maxAbsoluteVariance: number | null
  maxAbsoluteTotalImpact: number | null
}

export type EstimateFeedbackTrendMetricSummary = {
  averageVariance: number | null
  averageTotalImpact: number | null
  count: number
}

export type EstimateFeedbackTrendPattern = {
  key: string
  label: string
  count: number
  averageVariance: number | null
  averageTotalImpact: number | null
  totalImpact: number
}

export type EstimateFeedbackTrendSummary = {
  filters: EstimateFeedbackTrendResolvedFilters
  averageLaborVariance: number | null
  averagePaintVariance: number | null
  averageSuppliesVariance: number | null
  averageMissPerJob: number | null
  portfolioImpact: number
  jobsAnalyzed: number
  metrics: {
    labor: EstimateFeedbackTrendMetricSummary
    paint: EstimateFeedbackTrendMetricSummary
    supplies: EstimateFeedbackTrendMetricSummary
  }
  patterns: EstimateFeedbackTrendPattern[]
}
