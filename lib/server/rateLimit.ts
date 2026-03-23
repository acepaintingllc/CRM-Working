type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function nowMs() {
  return Date.now()
}

export function checkLocalRateLimit(params: {
  key: string
  max: number
  windowMs: number
}) {
  const now = nowMs()
  const current = buckets.get(params.key)

  if (!current || now >= current.resetAt) {
    buckets.set(params.key, { count: 1, resetAt: now + params.windowMs })
    return { ok: true as const, remaining: params.max - 1, resetAt: now + params.windowMs }
  }

  if (current.count >= params.max) {
    return { ok: false as const, remaining: 0, resetAt: current.resetAt }
  }

  current.count += 1
  buckets.set(params.key, current)
  return { ok: true as const, remaining: params.max - current.count, resetAt: current.resetAt }
}

