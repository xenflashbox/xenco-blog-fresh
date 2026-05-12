import type { CollectionConfig, CollectionBeforeChangeHook, PayloadRequest } from 'payload'

// After any certification is saved or deleted, recompute the parent vendor's
// has_verified_certifications flag. This keeps the badge accurate without
// requiring a full re-crawl of certs at query time.
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
  })

  await req.payload.update({
    collection: 'vendors',
    id: vendorId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { has_verified_certifications: result.totalDocs > 0 } as any,
    overrideAccess: true,
  })
}

/**
 * Option 1 implementation: source_quote is required for NEW records only.
 * Existing records without source_quote are marked as awaiting re-verification
 * to surface them in the editorial review queue for backfill.
 */
const enforceSourceQuoteProvenance: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data

  const hasSourceQuote = data.source_quote && String(data.source_quote).trim().length >= 20

  if (operation === 'create') {
    // NEW records: source_quote is mandatory
    if (!hasSourceQuote) {
      throw new Error(
        'source_quote is required for new certification records and must be at least 20 characters. ' +
        "Provide a verbatim quote from the vendor's public source page where this certification is claimed. " +
        'The source URL goes in the source_url field.'
      )
    }
  }

  if (operation === 'update') {
    // EXISTING records: if source_quote is missing/empty/too short, flag for re-verification
    // but allow the save to proceed (don't break existing workflow)
    const existingHasQuote = originalDoc?.source_quote && String(originalDoc.source_quote).trim().length >= 20

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
    // Provenance enforcement — source_quote is required for NEW records via hook.
    // Existing records without source_quote are flagged for editorial re-verification.
    {
      name: 'source_quote',
      type: 'textarea',
      // NOT required at field level — enforced via beforeChange hook for new records only
      admin: {
        description:
          "Verbatim quote from the vendor's public source page where this certification is claimed. " +
          'Required for new records to prevent hallucinated certifications. ' +
          'Capture the exact wording, not a paraphrase. The source URL goes in the verification_url field.',
      },
      validate: (value: string | null | undefined): true | string => {
        // Allow null/empty for existing records (hook handles enforcement for new records)
        if (value !== null && value !== undefined && value.trim().length > 0 && value.trim().length < 20) {
          return 'source_quote must be at least 20 characters if provided. Capture the exact wording from the vendor site.'
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
          'Clear by adding a valid source_quote (20+ chars).',
      },
    },
  ],
}
