import type {
  JobReviewReadModel,
  JobReviewStatus,
} from '@/types/jobs/feedback'
import {
  buildJobReviewPayload,
  type JobReviewFormState,
} from '@/lib/estimate-feedback/forms'

export type JobReviewSaveDeps = {
  jobId: string
  estimateSnapshotId: string
  form: JobReviewFormState
  saveReview: (jobId: string, payload: ReturnType<typeof buildJobReviewPayload>) => Promise<{
    data: JobReviewReadModel
    notice: string | null
  }>
}

export type JobReviewLockDeps = JobReviewSaveDeps & {
  lockReview: (jobId: string, estimateSnapshotId: string) => Promise<{
    data: JobReviewReadModel
    notice?: string | null
  }>
}

export async function saveJobReviewFlow(
  deps: JobReviewSaveDeps,
  status: Exclude<JobReviewStatus, 'locked'>
) {
  const payload = buildJobReviewPayload(deps.form, deps.estimateSnapshotId, status)
  const result = await deps.saveReview(deps.jobId, payload)
  return {
    model: result.data,
    notice: result.notice ?? (status === 'reviewed' ? 'Job review marked reviewed.' : 'Job review saved.'),
  }
}

export async function lockJobReviewFlow(deps: JobReviewLockDeps) {
  await saveJobReviewFlow(deps, 'reviewed')
  const result = await deps.lockReview(deps.jobId, deps.estimateSnapshotId)
  return {
    model: result.data,
    notice: result.notice ?? 'Job review locked.',
  }
}
