import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  // Match admin routes and sensitive API routes only
  // Content collection APIs are now PUBLIC for GET (ISR caching handles cost control)
  matcher: [
    '/admin/:path*',
    '/api/users/:path*',
    '/api/graphql',
    '/api/graphql-playground',
  ],
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const pathname = url.pathname
  const method = req.method.toUpperCase()
  const isReadOnly = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'

  // Protect sensitive endpoints: /api/users and GraphQL
  // These always require authentication regardless of method
  if (
    pathname.startsWith('/api/users') ||
    pathname === '/api/graphql' ||
    pathname === '/api/graphql-playground'
  ) {
    const hasPayloadToken = req.cookies.has('payload-token')
    const authHeader = req.headers.get('authorization') || ''
    const hasApiKey = authHeader.startsWith('Bearer ') || authHeader.includes('API-Key')

    if (!hasPayloadToken && !hasApiKey) {
      return new NextResponse(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }

  // Admin login loop fix (existing logic)
  if (pathname !== '/admin/login') return NextResponse.next()

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
