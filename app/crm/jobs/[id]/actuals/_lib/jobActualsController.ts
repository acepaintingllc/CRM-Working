import type {
  JobActualsRecord,
} from '@/types/jobs/feedback'
import {
  buildJobActualsDraftPayload,
  type JobActualsFormState,
} from '@/lib/estimate-feedback/forms'

export type JobActualsControllerDeps = {
  jobId: string
  estimateSnapshotId: string
  form: JobActualsFormState
  saveDraft: (
    jobId: string,
    payload: ReturnType<typeof buildJobActualsDraftPayload>
  ) => Promise<{
    data: JobActualsRecord
    notice: string | null
  }>
  submit: (jobId: string, estimateSnapshotId: string) => Promise<{
    data: JobActualsRecord
    notice?: string | null
  }>
}

export type JobActualsDraftFlowResult = {
  actuals: JobActualsRecord
  notice: string
}

export type JobActualsSubmitFlowResult =
  | {
      ok: true
      savedDraft: JobActualsDraftFlowResult
      submitted: JobActualsDraftFlowResult
      actuals: JobActualsRecord
      notice: string
    }
  | {
      ok: false
      savedDraft: JobActualsDraftFlowResult
      submitted: null
      actuals: JobActualsRecord
      notice: string
      submitError: unknown
    }

export async function saveJobActualsDraftFlow(
  deps: JobActualsControllerDeps
): Promise<JobActualsDraftFlowResult> {
  const payload = buildJobActualsDraftPayload(deps.form, deps.estimateSnapshotId)
  const result = await deps.saveDraft(deps.jobId, payload)
  return {
    actuals: result.data,
    notice: result.notice ?? 'Job actuals saved.',
  }
}

export async function submitJobActualsFlow(
  deps: JobActualsControllerDeps
): Promise<JobActualsSubmitFlowResult> {
  const savedDraft = await saveJobActualsDraftFlow(deps)

  try {
    const result = await deps.submit(deps.jobId, deps.estimateSnapshotId)
    const submitted = {
      actuals: result.data,
      notice: result.notice ?? 'Job actuals submitted.',
    }

    return {
      ok: true,
      savedDraft,
      submitted,
      actuals: submitted.actuals,
      notice: submitted.notice,
    }
  } catch (submitError) {
    return {
      ok: false,
      savedDraft,
      submitted: null,
      actuals: savedDraft.actuals,
      notice: 'Draft saved. Actuals were not submitted.',
      submitError,
    }
  }
}
