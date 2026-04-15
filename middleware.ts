import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// All frontend origins allowed to call the CMS API from a browser.
const ALLOWED_ORIGINS = new Set([
  'https://cms.xencolabs.com',
  'https://publish.xencolabs.com',
  'https://cms.aer-worldwide.com',
  'https://cms.blogcraft.app',
  'https://cms.devmaestro.io',
  'https://cms.diabetescompass.com',
  'https://cms.fiberinsider.com',
  'https://cms.fightclubtech.com',
  'https://cms.fightmybank.com',
  'https://cms.homebeautyspa.com',
  'https://cms.imagecrafter.app',
  'https://cms.isthisagoodjob.com',
  'https://cms.landingcraft.app',
  'https://cms.landlordhell.com',
  'https://cms.legalcraft.app',
  'https://cms.lexiexplains.com',
  'https://cms.mcpforge.org',
  'https://cms.nexusguard.dev',
  'https://cms.planaheaddaily.com',
  'https://cms.promptmarketer.app',
  'https://cms.renterandlandlord.com',
  'https://cms.resumecoach.me',
  'https://cms.snackabletiktok.com',
  'https://cms.sonomagrovesuites.com',
  'https://cms.tinatortoise.com',
  'https://cms.winecountrycorner.com',
  'https://planaheaddaily.com',
  'https://www.planaheaddaily.com',
  'https://winecountrycorner.com',
  'https://www.winecountrycorner.com',
  'https://promptmarketer.app',
  'https://www.promptmarketer.app',
  'https://resumecoach.me',
  'https://www.resumecoach.me',
  'https://fiberinsider.com',
  'https://www.fiberinsider.com',
  'https://sonomagrovesuites.com',
  'https://www.sonomagrovesuites.com',
  'https://snackabletiktok.com',
  'https://www.snackabletiktok.com',
  'https://fightclubtech.com',
  'https://www.fightclubtech.com',
  'https://aer-worldwide.com',
  'https://www.aer-worldwide.com',
  'https://blogcraft.app',
  'https://www.blogcraft.app',
  'https://diabetescompass.com',
  'https://www.diabetescompass.com',
  'https://fightmybank.com',
  'https://www.fightmybank.com',
  'https://homebeautyspa.com',
  'https://www.homebeautyspa.com',
  'https://landlordhell.com',
  'https://www.landlordhell.com',
  'https://legalcraft.app',
  'https://www.legalcraft.app',
  'https://lexiexplains.com',
  'https://www.lexiexplains.com',
  'https://mcpforge.org',
  'https://www.mcpforge.org',
  'https://renterandlandlord.com',
  'https://www.renterandlandlord.com',
  'https://tinatortoise.com',
  'https://www.tinatortoise.com',
  'https://xencolabs.com',
  'https://www.xencolabs.com',
])

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Encoding, x-apollo-tracing, X-Payload-HTTP-Method-Override',
}

export const config = {
  // Match admin routes, sensitive API routes, and all API routes for CORS
  matcher: [
    '/admin/:path*',
    '/api/:path*',
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
  const origin = req.headers.get('origin') ?? ''

  // Handle CORS for all /api/* routes
  if (pathname.startsWith('/api/')) {
    const isAllowed = ALLOWED_ORIGINS.has(origin)

    // Preflight: respond immediately with CORS headers
    if (method === 'OPTIONS') {
      const res = new NextResponse(null, { status: 204 })
      if (isAllowed) res.headers.set('Access-Control-Allow-Origin', origin)
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
      res.headers.set('Access-Control-Max-Age', '86400')
      return res
    }

    // For actual requests: inject CORS headers via NextResponse.next()
    if (isAllowed) {
      const res = NextResponse.next()
      res.headers.set('Access-Control-Allow-Origin', origin)
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
      // Only gate /api/users/* and GraphQL — skip CORS-only paths
      if (
        !pathname.startsWith('/api/users') &&
        pathname !== '/api/graphql' &&
        pathname !== '/api/graphql-playground'
      ) {
        return res
      }
      // Fall through for protected routes — they'll be gated below
    }
  }

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
