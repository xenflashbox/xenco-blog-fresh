import type { CollectionConfig } from 'payload'

export const VendorCertifications: CollectionConfig = {
  slug: 'vendor-certifications',
  admin: {
    useAsTitle: 'certification_name',
    defaultColumns: ['vendor', 'certification_name', 'certification_body', 'verification_status', 'valid_through'],
    group: 'Compare ITAD',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
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
    // Addendum 2 — provenance enforcement. Required at the collection level as
    // defense-in-depth: the import script catches missing source_quote first,
    // but this prevents an editor from saving a cert through the admin UI
    // without supplying a verbatim textual claim from the vendor's website.
    {
      name: 'source_quote',
      type: 'text',
      required: true,
      admin: {
        description:
          "Verbatim quote from the vendor's page making this certification claim. " +
          'Required. A cert record without a source quote fails our provenance ' +
          'requirement and cannot be published. If you cannot find an explicit ' +
          "textual claim on the vendor's site, do not create the cert record — " +
          'certifications inferred from logos or design cues alone are not self-reports.',
      },
      validate: (value: string | null | undefined): true | string => {
        if (!value || value.trim().length < 10) {
          return (
            'source_quote is required and must be at least 10 characters. ' +
            'This field exists to enforce the provenance requirement published ' +
            'on /methodology. If no textual claim exists on the vendor site, ' +
            'do not create this certification record.'
          )
        }
        return true
      },
    },
  ],
}
