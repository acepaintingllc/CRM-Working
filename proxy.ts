import { NextRequest, NextResponse } from 'next/server'

const defaultMaxApiBodyBytes = 20 * 1024 * 1024

function resolveMaxApiBodyBytes() {
  const raw = process.env.ACECRM_API_MAX_BODY_BYTES
  if (!raw) return defaultMaxApiBodyBytes
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultMaxApiBodyBytes
  return parsed
}

const maxApiBodyBytes = resolveMaxApiBodyBytes()

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0]?.toLowerCase() ?? ''
  const path = request.nextUrl.pathname
  const method = request.method.toUpperCase()

  if (hostname === 'crm.newburghacepainting.com' && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/crm'
    return NextResponse.redirect(url)
  }

  const isFieldPath = path === '/field' || path.startsWith('/field/')
  const permissionsPolicy = isFieldPath
    ? 'camera=(self), microphone=(), geolocation=()'
    : 'camera=(), microphone=(), geolocation=()'

  // Basic CSRF guard for cookie-auth mutating API calls.
  if (
    path.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  ) {
    const rawLength = request.headers.get('content-length')
    if (rawLength != null && rawLength.trim() !== '') {
      const parsedLength = Number.parseInt(rawLength, 10)
      if (!Number.isFinite(parsedLength) || parsedLength < 0) {
        const invalidLength = NextResponse.json({ error: 'Invalid Content-Length header' }, { status: 400 })
        invalidLength.headers.set('Permissions-Policy', permissionsPolicy)
        return invalidLength
      }
      if (parsedLength > maxApiBodyBytes) {
        const tooLarge = NextResponse.json({ error: 'Request body too large' }, { status: 413 })
        tooLarge.headers.set('Permissions-Policy', permissionsPolicy)
        return tooLarge
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
        const denied = NextResponse.json({ error: 'Unauthorized request origin' }, { status: 403 })
        denied.headers.set('Permissions-Policy', permissionsPolicy)
        return denied
      }
    }
  }

  const response = NextResponse.next()
  response.headers.set('Permissions-Policy', permissionsPolicy)
  return response
}

export const config = {
  matcher: '/:path*',
}
