import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0]?.toLowerCase() ?? ''

  if (hostname === 'crm.newburghacepainting.com' && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/crm'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}
