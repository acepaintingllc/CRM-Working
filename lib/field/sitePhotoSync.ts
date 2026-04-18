export const sitePhotoRetryBaseMs = 750
export const sitePhotoRetryMaxMs = 30000

export function computeUploadRetryDelayMs(retryCount: number) {
  const normalized = Number.isFinite(retryCount) ? Math.max(0, Math.floor(retryCount)) : 0
  const exponential = sitePhotoRetryBaseMs * Math.pow(2, Math.min(normalized, 8))
  return Math.min(sitePhotoRetryMaxMs, exponential)
}

export function buildNextRetryAtIso(nowIso: string, retryCount: number) {
  const now = new Date(nowIso)
  const delayMs = computeUploadRetryDelayMs(retryCount)
  return new Date(now.getTime() + delayMs).toISOString()
}

export function isRetryDue(nextRetryAt: string | null | undefined, nowIso: string) {
  if (!nextRetryAt) return true
  const dueAt = Date.parse(nextRetryAt)
  if (Number.isNaN(dueAt)) return true
  const nowAt = Date.parse(nowIso)
  if (Number.isNaN(nowAt)) return true
  return dueAt <= nowAt
}

export function shouldRetryUploadStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}

