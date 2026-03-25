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

/** Unauthenticated Payload auth routes (must match @payloadcms auth endpoints). */
function isPublicUsersAuthPath(pathname: string, method: string): boolean {
  const m = method.toUpperCase()
  if (pathname === '/api/users/init' && (m === 'GET' || m === 'HEAD')) return true
  if (pathname === '/api/users/access' && m === 'GET') return true
  if (pathname === '/api/users/login' && m === 'POST') return true
  if (pathname === '/api/users/forgot-password' && m === 'POST') return true
  if (pathname === '/api/users/refresh-token' && m === 'POST') return true
  if (pathname === '/api/users/first-register' && m === 'POST') return true
  if (pathname === '/api/users/reset-password' && m === 'POST') return true
  if (pathname === '/api/users/unlock' && m === 'POST') return true
  if (pathname.startsWith('/api/users/verify/') && m === 'POST') return true
  return false
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // Protect sensitive endpoints: /api/users and GraphQL
  // /api/users/* requires auth except Payload's login, init, forgot-password, etc.
  if (
    pathname.startsWith('/api/users') ||
    pathname === '/api/graphql' ||
    pathname === '/api/graphql-playground'
  ) {
    const skipUsersGate = pathname.startsWith('/api/users') && isPublicUsersAuthPath(pathname, method)

    if (!skipUsersGate) {
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
