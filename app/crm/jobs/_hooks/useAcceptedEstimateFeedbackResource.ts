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

function getOperationalAcceptedEstimateSnapshotId(job: JobDetail | null) {
  // Operational feedback flows are scoped to the canonical accepted-estimate
  // snapshot only. Navigation-only quote fallback ids must never unlock these
  // reads or repairs.
  const snapshotId = job?.accepted_estimate?.estimate_snapshot_id
  return typeof snapshotId === 'string' && snapshotId.trim() ? snapshotId : null
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
  const estimateSnapshotId = getOperationalAcceptedEstimateSnapshotId(job)
  if (!estimateSnapshotId) {
    return buildMissingSnapshotResource(job)
  }

  const feedback = await loadFeedback(jobId, estimateSnapshotId)
  return buildLoadedResource({ job, feedback })
}

export function useAcceptedEstimateSnapshotRepair<TResource>({
  jobId,
  resource,
  successNotice = 'Accepted quote snapshot repaired.',
  failureMessage = 'Failed to repair accepted quote snapshot.',
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
