import type { StageEmailStage } from '@/lib/jobs/types'

export function makeIdempotencyKey(stage: StageEmailStage, jobId: string) {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `stage:${stage}:job:${jobId}:${suffix}`
}
