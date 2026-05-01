import { NextResponse } from 'next/server'

export function GET(request: Request) {
  return NextResponse.redirect(new URL('/api/quotes/rates-flags', request.url), 307)
}
