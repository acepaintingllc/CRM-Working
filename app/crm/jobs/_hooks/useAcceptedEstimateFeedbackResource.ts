'use client'

import { useCallback, useState } from 'react'
import {
  loadJobRecord,
  repairAcceptedEstimateSnapshot,
} from '@/lib/jobs/client'
import type { JobDetail } from '@/types/jobs/api'

type LoadAcceptedEstimateFeedbackResourceParams<TFeedback, TResource> = {
  jobId: string | null | undefined
  missingJobIdError: string
  loadFeedback: (jobId: string, estimateSnapshotId: string) => Promise<TFeedback>
  buildMissingSnapshotResource: (job: JobDetail | null) => TResource
  buildLoadedResource: (params: {
    job: JobDetail | null
    feedback: TFeedback
  }) => TResource
}

type EditableFeedbackResourceBoundary<TResource> = {
  reload: () => Promise<{ ok: boolean; data: TResource | null; error: string | null }>
  clearFeedback: () => void
  setNotice: (value: string | null) => void
  setError: (value: string | null) => void
}

export async function loadAcceptedEstimateFeedbackResource<TFeedback, TResource>({
  jobId,
  missingJobIdError,
  loadFeedback,
  buildMissingSnapshotResource,
  buildLoadedResource,
}: LoadAcceptedEstimateFeedbackResourceParams<TFeedback, TResource>) {
  if (!jobId || typeof jobId !== 'string') {
    throw new Error(missingJobIdError)
  }

  const job = await loadJobRecord(jobId)
  const estimateSnapshotId = job?.accepted_quote?.estimate_snapshot_id ?? null
  if (!estimateSnapshotId) {
    return buildMissingSnapshotResource(job)
  }

  const feedback = await loadFeedback(jobId, estimateSnapshotId)
  return buildLoadedResource({ job, feedback })
}

export function useAcceptedEstimateSnapshotRepair<TResource>({
  jobId,
  resource,
  successNotice = 'Accepted estimate snapshot repaired.',
  failureMessage = 'Failed to repair accepted estimate snapshot.',
}: {
  jobId: string | null | undefined
  resource: EditableFeedbackResourceBoundary<TResource>
  successNotice?: string
  failureMessage?: string
}) {
  const [repairingSnapshot, setRepairingSnapshot] = useState(false)

  const repairSnapshot = useCallback(async () => {
    if (!jobId || typeof jobId !== 'string') return false
    setRepairingSnapshot(true)
    resource.clearFeedback()
    try {
      const result = await repairAcceptedEstimateSnapshot(jobId)
      const loaded = await resource.reload()
      if (loaded.ok) {
        resource.setNotice(result.notice ?? successNotice)
      }
      return loaded.ok
    } catch (repairError) {
      resource.setError(
        repairError instanceof Error ? repairError.message : failureMessage
      )
      return false
    } finally {
      setRepairingSnapshot(false)
    }
  }, [failureMessage, jobId, resource, successNotice])

  return {
    repairingSnapshot,
    repairSnapshot,
  }
}
