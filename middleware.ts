import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  // Match admin routes AND Payload's API routes (but not our custom /api/support/* endpoints)
  matcher: [
    '/admin/:path*',
    '/api/users/:path*',
    '/api/articles/:path*',
    '/api/media/:path*',
    '/api/sites/:path*',
    '/api/authors/:path*',
    '/api/categories/:path*',
    '/api/tags/:path*',
    '/api/support-kb-articles/:path*',
    '/api/support-playbooks/:path*',
    '/api/support-announcements/:path*',
    '/api/graphql',
    '/api/graphql-playground',
  ],
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const pathname = url.pathname

  // Block Payload's REST API and GraphQL endpoints from public access
  // These were waking the database on every bot/crawler hit
  // Our custom /api/support/* endpoints are NOT matched here (they have their own auth)
  if (
    pathname.startsWith('/api/users') ||
    pathname.startsWith('/api/articles') ||
    pathname.startsWith('/api/media') ||
    pathname.startsWith('/api/sites') ||
    pathname.startsWith('/api/authors') ||
    pathname.startsWith('/api/categories') ||
    pathname.startsWith('/api/tags') ||
    pathname.startsWith('/api/support-kb-articles') ||
    pathname.startsWith('/api/support-playbooks') ||
    pathname.startsWith('/api/support-announcements') ||
    pathname === '/api/graphql' ||
    pathname === '/api/graphql-playground'
  ) {
    // Check for Payload auth cookie or API key
    const hasPayloadToken = req.cookies.has('payload-token')
    const hasApiKey = req.headers.get('authorization')?.startsWith('Bearer ')

    if (!hasPayloadToken && !hasApiKey) {
      // Return 401 immediately without initializing Payload (no DB wake!)
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
