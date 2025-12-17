// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureUniqueSlugForSite(args: {
  payload: { find: (args: any) => Promise<any> }
  collection: 'categories' | 'tags' | 'authors'
  siteId: string
  desiredSlug: string
  currentId?: string
}): Promise<string> {
  const { payload, collection, siteId, desiredSlug, currentId } = args

  const base = desiredSlug
  let candidate = base
  let i = 2

  // loop until unique
  while (true) {
    const res = await payload.find({
      collection,
      where: {
        and: [
          { site: { equals: siteId } },
          { slug: { equals: candidate } },
          ...(currentId ? [{ id: { not_equals: currentId } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (!res.docs?.length) return candidate
    candidate = `${base}-${i++}`
  }
}

