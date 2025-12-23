import type { Endpoint } from 'payload'
import { getMeiliClient, ensureArticlesIndexSettings } from '../lib/meili'
import { resolveSiteForRequest } from '../lib/site'

// Slug sanitizer: only allow lowercase alphanumeric and hyphens (prevents filter injection)
const isSafeSlug = (s: string): boolean => /^[a-z0-9-]+$/.test(s)

// Allowed sort options (must match MeiliSearch sortableAttributes)
const ALLOWED_SORTS = ['publishedAt:desc', 'publishedAt:asc', 'updatedAt:desc', 'title:asc'] as const
type SortOption = (typeof ALLOWED_SORTS)[number]

export const searchArticlesEndpoint: Endpoint = {
  path: '/search',
  method: 'get',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (req: any) => {
    const q = typeof req?.query?.q === 'string' ? req.query.q.trim() : ''
    const limit = Math.min(50, Math.max(1, Number(req?.query?.limit ?? 10) || 10))
    const page = Math.max(1, Number(req?.query?.page ?? 1) || 1)

    // Parse filter params BEFORE early return check (for browse mode support)
    const siteSlugParam = typeof req?.query?.siteSlug === 'string' ? req.query.siteSlug.trim() : null
    const siteSlugHeader =
      typeof req?.headers?.get === 'function'
        ? req.headers.get('x-site-slug')
        : req?.headers?.['x-site-slug'] || req?.headers?.['X-Site-Slug'] || null
    const tagParam = typeof req?.query?.tag === 'string' ? req.query.tag.trim() : ''
    const categoryParam = typeof req?.query?.category === 'string' ? req.query.category.trim() : ''

    // Check if we have any filters that would enable browse mode
    const hasFilters = Boolean(siteSlugParam || siteSlugHeader || tagParam || categoryParam)

    // Early return only if no query AND no filters (browse mode requires at least one filter)
    if (!q && !hasFilters) {
      return new Response(JSON.stringify({ ok: true, q, results: [], page, limit, total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Resolve site: try siteSlug query param, then x-site-slug header, then fallback to host resolution
    // IMPORTANT: We need both id (for response) and slug (for MeiliSearch filter)
    let site: { id: string; slug: string } | null = null

    if (siteSlugParam) {
      // Lookup by slug from query param
      const bySlug = await req.payload.find({
        collection: 'sites',
        where: { slug: { equals: siteSlugParam } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (bySlug.docs?.[0]?.id) {
        site = { id: String(bySlug.docs[0].id), slug: bySlug.docs[0].slug }
      }
    } else if (siteSlugHeader) {
      // Lookup by slug from header
      const bySlug = await req.payload.find({
        collection: 'sites',
        where: { slug: { equals: siteSlugHeader } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (bySlug.docs?.[0]?.id) {
        site = { id: String(bySlug.docs[0].id), slug: bySlug.docs[0].slug }
      }
    }

    // Fallback to host-based resolution
    if (!site) {
      site = await resolveSiteForRequest(req.payload, req.headers)
    }

    if (!site?.id || !site?.slug) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'No site found. Create a default Site (isDefault=true).',
        }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      )
    }

    const meili = getMeiliClient()
    if (!meili) {
      return new Response(JSON.stringify({ ok: false, error: 'MeiliSearch not configured.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }

    await ensureArticlesIndexSettings()

    const indexName = process.env.MEILISEARCH_ARTICLES_INDEX || 'articles'
    const index = meili.index(indexName)

    const offset = (page - 1) * limit

    // Build filter parts (base filters always required)
    const filterParts: string[] = [
      `site = "${site.slug}"`,
      `status = "published"`,
    ]

    // Parse and sanitize tag slugs (prevents filter injection)
    const tagSlugs = tagParam
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean)
      .filter(isSafeSlug)

    // Add tag filter: (tags = "slug1" OR tags = "slug2")
    if (tagSlugs.length === 1) {
      filterParts.push(`tags = "${tagSlugs[0]}"`)
    } else if (tagSlugs.length > 1) {
      const tagOr = tagSlugs.map((t: string) => `tags = "${t}"`).join(' OR ')
      filterParts.push(`(${tagOr})`)
    }

    // Parse and sanitize category slugs (prevents filter injection)
    const catSlugs = categoryParam
      .split(',')
      .map((c: string) => c.trim())
      .filter(Boolean)
      .filter(isSafeSlug)

    // Add category filter: (categories = "slug1" OR categories = "slug2")
    if (catSlugs.length === 1) {
      filterParts.push(`categories = "${catSlugs[0]}"`)
    } else if (catSlugs.length > 1) {
      const catOr = catSlugs.map((c: string) => `categories = "${c}"`).join(' OR ')
      filterParts.push(`(${catOr})`)
    }

    // Join all filter parts with AND
    const filter = filterParts.join(' AND ')

    // Parse and validate sort param
    const sortParam = typeof req?.query?.sort === 'string' ? req.query.sort.trim() : ''
    let sort: SortOption[] | undefined

    if (sortParam && ALLOWED_SORTS.includes(sortParam as SortOption)) {
      sort = [sortParam as SortOption]
    } else if (!q) {
      // Browse mode (no search query): default to newest first
      sort = ['publishedAt:desc']
    }

    // Execute search
    const res = await index.search(q, {
      limit,
      offset,
      filter,
      ...(sort ? { sort } : {}),
    })

    // Shape results: exclude large contentText, keep essential fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shapedResults = res.hits.map((hit: any) => {
      const { contentText, ...rest } = hit
      // Optionally include a snippet if needed
      const contentTextSnippet =
        typeof contentText === 'string' && contentText.length > 0
          ? contentText.substring(0, 300).trim() + (contentText.length > 300 ? '...' : '')
          : null
      return {
        ...rest,
        ...(contentTextSnippet ? { contentTextSnippet } : {}),
      }
    })

    return new Response(
      JSON.stringify({
        ok: true,
        q,
        siteId: site.id,
        siteSlug: site.slug,
        ...(tagSlugs.length ? { tags: tagSlugs } : {}),
        ...(catSlugs.length ? { categories: catSlugs } : {}),
        ...(sort ? { sort: sort[0] } : {}),
        page,
        limit,
        total: res.estimatedTotalHits ?? res.hits.length,
        results: shapedResults,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  },
}
