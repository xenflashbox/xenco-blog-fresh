import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: ['/admin/:path*'],
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl

  // Only guard the login route
  if (url.pathname !== '/admin/login') return NextResponse.next()

  const redirect = url.searchParams.get('redirect')
  if (!redirect) return NextResponse.next()

  // If redirect points back to login (or is malformed like ".../admin/loginredirect=..."),
  // remove it to stop the infinite loop.
  let decoded = redirect
  try {
    decoded = decodeURIComponent(redirect)
  } catch {
    // ignore decode errors
  }

  if (
    decoded.includes('/admin/login') ||
    decoded.includes('/admin/loginredirect=') ||
    decoded.includes('admin/loginredirect=')
  ) {
    const clean = new URL(url.toString())
    clean.searchParams.delete('redirect')
    return NextResponse.redirect(clean)
  }

  return NextResponse.next()
}
