type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
let _warnedOnce = false

function nowMs() {
  return Date.now()
}

// Emits a single warning per cold start when running in production without a
// persistent backend. Module-level flag ensures it fires at most once per
// Vercel function instance so it doesn't flood logs.
function warnInMemoryOnce() {
  if (_warnedOnce || process.env.NODE_ENV !== 'production') return
  _warnedOnce = true
  console.error(
    '[rateLimit] In-memory rate limiter is active. Limits reset on every Vercel cold start ' +
      'and are not shared across concurrent instances — limits may be bypassed under load. ' +
      'To upgrade to persistent cross-instance rate limiting, see the "Rate Limiting" section ' +
      'of README.md and set RATE_LIMIT_BACKEND=upstash.'
  )
}

export function checkLocalRateLimit(params: {
  key: string
  max: number
  windowMs: number
}) {
  warnInMemoryOnce()

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
