/**
 * ISR Revalidation utility for triggering on-demand cache invalidation
 * on front-end sites when articles are published/updated.
 *
 * This is part of our Neon cost-control strategy:
 * - Front-ends use ISR (force-static + revalidate=3600) to cache pages
 * - Payload calls this on publish/update to instantly refresh the cache
 * - Crawlers hit cached HTML, not the CMS API (saves DB compute)
 */

import type { Payload } from 'payload'

interface Site {
  id: string | number
  name?: string
  revalidateUrl?: string
  revalidateSecret?: string
}

interface Article {
  id: string | number
  slug?: string
  site?: Site | string | number | unknown
}

/**
 * Trigger revalidation for an article on its associated site's front-end.
 * This is a fire-and-forget operation that should not block the CMS response.
 */
export async function triggerRevalidation(
  payload: Payload,
  article: Article,
): Promise<void> {
  const slug = article.slug
  if (!slug) {
    payload.logger.warn({ articleId: article.id }, 'Article has no slug, skipping revalidation')
    return
  }

  // Resolve the site - it might be an ID or a populated object
  let site: Site | null = null

  if (typeof article.site === 'object' && article.site !== null) {
    site = article.site as Site
  } else if (article.site) {
    // Need to fetch the site
    try {
      const siteDoc = await payload.findByID({
        collection: 'sites',
        id: String(article.site),
        depth: 0,
      })
      if (siteDoc) {
        site = siteDoc as unknown as Site
      }
    } catch (err) {
      payload.logger.warn({ err, siteId: article.site }, 'Failed to fetch site for revalidation')
      return
    }
  }

  if (!site) {
    payload.logger.warn({ articleId: article.id }, 'Article has no site, skipping revalidation')
    return
  }

  const revalidateUrl = site.revalidateUrl
  const revalidateSecret = site.revalidateSecret

  if (!revalidateUrl) {
    // Site doesn't have revalidation configured - that's fine, skip silently
    return
  }

  // Build the revalidation URL
  const url = new URL(revalidateUrl)
  if (revalidateSecret) {
    url.searchParams.set('secret', revalidateSecret)
  }
  url.searchParams.set('slug', slug)

  // Fire-and-forget: don't await, don't block the CMS response
  // Use void to explicitly mark this as intentionally not awaited
  void (async () => {
    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Short timeout - if the front-end is slow, don't hang
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        payload.logger.warn(
          { url: url.toString(), status: response.status, body: text.slice(0, 200) },
          'Revalidation request failed',
        )
      } else {
        payload.logger.info(
          { url: url.toString(), slug, siteName: site?.name },
          'Revalidation triggered successfully',
        )
      }
    } catch (err) {
      // Network errors, timeouts, etc - log but don't fail
      payload.logger.warn({ err, url: url.toString() }, 'Revalidation request error')
    }
  })()
}
