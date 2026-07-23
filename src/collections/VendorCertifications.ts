import type { CollectionConfig, CollectionBeforeChangeHook, PayloadRequest } from 'payload'

// Chosen minimum for source_quote (schema-addendum-2 specified 10; confirmed
// with the Compare ITAD team 2026-07-09 — their importer filters at 10 too).
const SOURCE_QUOTE_MIN_LENGTH = 10

// After any certification is saved or deleted, recompute the parent vendor's
// has_verified_certifications flag. This keeps the badge accurate without
// requiring a full re-crawl of certs at query time.
//
// `req` MUST be passed to the nested payload operations: without it the vendor
// update opens a second DB session whose upsert blocks on row locks held by the
// still-open cert-create transaction — a self-deadlock that hung every cert
// write until Cloudflare 524'd (observed in production 2026-07-08).
async function syncVerifiedBadge({
  doc,
  req,
}: {
  doc: { vendor?: number | { id: number } }
  req: PayloadRequest
}): Promise<void> {
  const vendorId = typeof doc.vendor === 'object' ? doc.vendor?.id : doc.vendor
  if (!vendorId) return

  const result = await req.payload.find({
    collection: 'vendor-certifications',
    where: {
      and: [
        { vendor: { equals: vendorId } },
        { verification_status: { equals: 'verified' } },
      ],
    },
    limit: 1,
    overrideAccess: true,
    req,
  })

  await req.payload.update({
    collection: 'vendors',
    id: vendorId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { has_verified_certifications: result.totalDocs > 0 } as any,
    overrideAccess: true,
    req,
  })
}

/**
 * Option 1 implementation: source_quote is required for NEW records only —
 * enforced by the field-level validate() (returns a message → clean 400, never
 * a masked 500 from a thrown Error). This hook only handles the update-path
 * editorial flagging for existing records that predate the provenance rule.
 */
const enforceSourceQuoteProvenance: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data

  const hasSourceQuote =
    data.source_quote && String(data.source_quote).trim().length >= SOURCE_QUOTE_MIN_LENGTH

  if (operation === 'update') {
    // EXISTING records: if source_quote is missing/empty/too short, flag for re-verification
    // but allow the save to proceed (don't break existing workflow)
    const existingHasQuote =
      originalDoc?.source_quote &&
      String(originalDoc.source_quote).trim().length >= SOURCE_QUOTE_MIN_LENGTH

    if (!hasSourceQuote && !existingHasQuote) {
      // Record has no valid source_quote - mark for editorial review
      data.verification_status = 'self-reported'
      data.awaiting_re_verification = true
    } else if (hasSourceQuote && !existingHasQuote) {
      // Source quote is being added - clear the re-verification flag
      data.awaiting_re_verification = false
    }
  }

  return data
}

export const VendorCertifications: CollectionConfig = {
  slug: 'vendor-certifications',
  admin: {
    useAsTitle: 'certification_name',
    defaultColumns: [
      'vendor',
      'certification_name',
      'certification_body',
      'verification_status',
      'valid_through',
    ],
    group: 'Compare ITAD',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    beforeChange: [enforceSourceQuoteProvenance],
    afterChange: [
      async ({ doc, req }) => {
        await syncVerifiedBadge({ doc, req })
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await syncVerifiedBadge({ doc, req })
      },
    ],
  },
  fields: [
    {
      name: 'vendor',
      type: 'relationship',
      relationTo: 'vendors',
      required: true,
      index: true,
    },
    { name: 'certification_name', type: 'text', required: true },
    { name: 'certification_body', type: 'text' },
    { name: 'cert_number', type: 'text' },
    { name: 'valid_from', type: 'date' },
    { name: 'valid_through', type: 'date' },
    {
      name: 'verification_status',
      type: 'select',
      options: [
        { label: 'Self-Reported', value: 'self-reported' },
        { label: 'Verified', value: 'verified' },
        { label: 'Expired', value: 'expired' },
        { label: 'Unverifiable', value: 'unverifiable' },
      ],
      defaultValue: 'self-reported',
      admin: { position: 'sidebar' },
    },
    { name: 'verification_url', type: 'text' },
    { name: 'verification_notes', type: 'textarea' },
    // Provenance enforcement — source_quote is required for NEW records,
    // enforced here at the field level so failures surface as a clean 400 with
    // this message (a thrown Error in a hook is masked as a generic 500 in prod).
    // Existing records without source_quote are flagged for editorial
    // re-verification by the beforeChange hook instead.
    {
      name: 'source_quote',
      type: 'textarea',
      // NOT `required: true` at field level — existing pre-provenance records
      // must remain saveable without a quote (update path flags them instead)
      admin: {
        description:
          "Verbatim quote from the vendor's public source page where this certification is claimed. " +
          `Required for new records (min ${SOURCE_QUOTE_MIN_LENGTH} characters) to prevent hallucinated certifications. ` +
          'Capture the exact wording, not a paraphrase. The source URL goes in the verification_url field.',
      },
      validate: (
        value: string | null | undefined,
        { operation }: { operation?: string },
      ): true | string => {
        const trimmedLength = typeof value === 'string' ? value.trim().length : 0

        if (operation === 'create' && trimmedLength < SOURCE_QUOTE_MIN_LENGTH) {
          return (
            `source_quote is required for new certification records and must be at least ${SOURCE_QUOTE_MIN_LENGTH} characters. ` +
            "Provide a verbatim quote from the vendor's public source page where this certification is claimed. " +
            'The source URL goes in the verification_url field.'
          )
        }

        // On update, allow empty (legacy records get flagged by the hook) but
        // reject short non-empty values.
        if (trimmedLength > 0 && trimmedLength < SOURCE_QUOTE_MIN_LENGTH) {
          return `source_quote must be at least ${SOURCE_QUOTE_MIN_LENGTH} characters if provided. Capture the exact wording from the vendor site.`
        }

        return true
      },
    },
    // Editorial workflow flag — set automatically when source_quote is missing
    {
      name: 'awaiting_re_verification',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Flagged for editorial review. Set automatically when source_quote is missing. ' +
          `Clear by adding a valid source_quote (${SOURCE_QUOTE_MIN_LENGTH}+ chars).`,
      },
    },
  ],
}
