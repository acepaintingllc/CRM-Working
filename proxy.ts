import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const defaultMaxApiBodyBytes = 20 * 1024 * 1024
const publicTokenRateLimitWindowMs = 60_000
const publicTokenRateLimitMaxRequests = 60

type PublicTokenRateLimitEntry = {
  count: number
  windowStart: number
}

const publicTokenRateLimitState = new Map<string, PublicTokenRateLimitEntry>()

function resolveMaxApiBodyBytes() {
  const raw = process.env.ACECRM_API_MAX_BODY_BYTES
  if (!raw) return defaultMaxApiBodyBytes
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultMaxApiBodyBytes
  return parsed
}

const maxApiBodyBytes = resolveMaxApiBodyBytes()

function applyPermissionsPolicy(response: NextResponse, value: string) {
  response.headers.set('Permissions-Policy', value)
  return response
}

function isStaticAssetPath(path: string) {
  if (
    path === '/favicon.ico' ||
    path.startsWith('/_next/') ||
    path.startsWith('/images/') ||
    path.startsWith('/public/')
  ) {
    return true
  }

  return /\.[^/]+$/.test(path)
}

function isPublicPassThroughPath(path: string) {
  return (
    path === '/login' ||
    path.startsWith('/auth/') ||
    path === '/estimate' ||
    path.startsWith('/estimate/') ||
    path === '/quote' ||
    path.startsWith('/quote/') ||
    path.startsWith('/api/estimate-public/') ||
    path.startsWith('/api/quote-public/') ||
    isStaticAssetPath(path)
  )
}

function isCrmProtectedPath(path: string) {
  return path === '/crm' || path.startsWith('/crm/')
}

function isRateLimitedPublicTokenPath(path: string) {
  return (
    /^\/api\/estimate-public\/[^/]+\/?$/.test(path) ||
    /^\/api\/quote-public\/[^/]+\/?$/.test(path)
  )
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const [first] = forwardedFor.split(',')
    if (first?.trim()) return first.trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp?.trim()) return realIp.trim()

  return 'unknown'
}

function enforcePublicTokenRateLimit(request: NextRequest) {
  const now = Date.now()
  const key = `${getClientIp(request)}:${request.nextUrl.pathname}`
  const existing = publicTokenRateLimitState.get(key)

  if (!existing || now - existing.windowStart >= publicTokenRateLimitWindowMs) {
    publicTokenRateLimitState.set(key, { count: 1, windowStart: now })
    return true
  }

  existing.count += 1
  return existing.count <= publicTokenRateLimitMaxRequests
}

export function resetPublicTokenRateLimitState() {
  publicTokenRateLimitState.clear()
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0]?.toLowerCase() ?? ''
  const path = request.nextUrl.pathname
  const method = request.method.toUpperCase()

  if (hostname === 'crm.newburghacepainting.com' && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/crm'
    return NextResponse.redirect(url)
  }

  const permissionsPolicy = 'camera=(), microphone=(), geolocation=()'

  if (isRateLimitedPublicTokenPath(path) && !enforcePublicTokenRateLimit(request)) {
    return applyPermissionsPolicy(
      NextResponse.json({ error: 'Too many requests' }, { status: 429 }),
      permissionsPolicy
    )
  }

  // Basic CSRF guard for cookie-auth mutating API calls.
  if (
    path.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  ) {
    const rawLength = request.headers.get('content-length')
    if (rawLength != null && rawLength.trim() !== '') {
      const parsedLength = Number.parseInt(rawLength, 10)
      if (!Number.isFinite(parsedLength) || parsedLength < 0) {
        return applyPermissionsPolicy(
          NextResponse.json({ error: 'Invalid Content-Length header' }, { status: 400 }),
          permissionsPolicy
        )
      }
      if (parsedLength > maxApiBodyBytes) {
        return applyPermissionsPolicy(
          NextResponse.json({ error: 'Request body too large' }, { status: 413 }),
          permissionsPolicy
        )
      }
    }

    const authHeader = request.headers.get('authorization') ?? ''
    const hasBearer = /^Bearer\s+.+/i.test(authHeader)
    const origin = request.headers.get('origin')
    const expectedOrigin = request.nextUrl.origin

    // If request is browser-originated and not bearer-authenticated, enforce same-origin.
    if (!hasBearer) {
      let originValue: string | null = null
      try {
        originValue = origin ? new URL(origin).origin : null
      } catch {
        originValue = null
      }
      if (!originValue || originValue !== expectedOrigin) {
        return applyPermissionsPolicy(
          NextResponse.json({ error: 'Unauthorized request origin' }, { status: 403 }),
          permissionsPolicy
        )
      }
    }
  }

  if (isPublicPassThroughPath(path) || !isCrmProtectedPath(path)) {
    return applyPermissionsPolicy(NextResponse.next(), permissionsPolicy)
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value)
          }

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })

          for (const cookie of cookiesToSet) {
            response.cookies.set(cookie.name, cookie.value, cookie.options)
          }
        },
      },
    }
  )

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    return applyPermissionsPolicy(NextResponse.redirect(loginUrl), permissionsPolicy)
  }

  return applyPermissionsPolicy(response, permissionsPolicy)
}

export const config = {
  matcher: '/:path*',
}
