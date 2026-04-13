import { NextRequest, NextResponse } from 'next/server'

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
    const authHeader = request.headers.get('authorization') ?? ''
    const hasBearer = /^Bearer\s+.+/i.test(authHeader)
    const origin = request.headers.get('origin')
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const forwardedHost = request.headers.get('x-forwarded-host')
    const resolvedHost = forwardedHost || host
    const resolvedProto = forwardedProto || (resolvedHost.includes('localhost') ? 'http' : 'https')
    const expectedOrigin = `${resolvedProto}://${resolvedHost}`

    // If request is browser-originated and not bearer-authenticated, enforce same-origin.
    if (!hasBearer) {
      if (!origin || origin !== expectedOrigin) {
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
