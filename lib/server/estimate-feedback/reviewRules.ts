import type {
  JobReviewDataQualityStatus,
  JobReviewStatus,
  JobReviewTrendEligibilityPreview,
} from '../../../types/jobs/feedback.ts'

export const JOB_REVIEW_METRIC_TOLERANCE_PERCENT = 10
export const JOB_REVIEW_TREND_ELIGIBLE_COLUMN = 'trend_eligible'

export type JobReviewTrendEligibilityInput = {
  status: JobReviewStatus | string
  data_quality_status: JobReviewDataQualityStatus | string
  exclude_from_trends: boolean
}

type TrendEligibilityQuery<T> = {
  eq(column: string, value: unknown): T
}

export function isJobReviewTrendEligible(review: JobReviewTrendEligibilityInput) {
  return (
    review.status === 'locked' &&
    review.data_quality_status === 'valid' &&
    !review.exclude_from_trends
  )
}

export function applyJobReviewTrendEligibilityFilter<T extends TrendEligibilityQuery<T>>(
  query: T
) {
  return query.eq(JOB_REVIEW_TREND_ELIGIBLE_COLUMN, true)
}

export function buildJobReviewTrendEligibilityPreview(): JobReviewTrendEligibilityPreview {
  const preview = (excludeFromTrends: boolean) => ({
    valid: isJobReviewTrendEligible({
      status: 'locked',
      data_quality_status: 'valid',
      exclude_from_trends: excludeFromTrends,
    }),
    questionable: isJobReviewTrendEligible({
      status: 'locked',
      data_quality_status: 'questionable',
      exclude_from_trends: excludeFromTrends,
    }),
    invalid: isJobReviewTrendEligible({
      status: 'locked',
      data_quality_status: 'invalid',
      exclude_from_trends: excludeFromTrends,
    }),
  })

  return {
    included: preview(false),
    excluded: preview(true),
  }
}
