# Compare ITAD — Schema Addendum 2

**Purpose:** Extends the Vendors and VendorCertifications collections to (1) handle non-directory parent companies like SK Group, (2) prevent the cert-hallucination pattern at the collection-level, and (3) surface data-quality context to readers.

**Applies to:** The Payload CMS backend (`cms.compareitad.com`). This addendum supersedes and extends the original schema in section 2 of `compareITAD-admin-handoff.md` and the first addendum in section 3 of `compareITAD-vendor-crawl-roster.md`.

**Deploy before:** Running `npm run import:vendors -- --execute` on any new vendor batch.

---

## 1. Vendors collection — two new text-based parent fields

The `parent_company` relationship field handles the Iron Mountain → Wisetek / CXtec → Atlantix pattern where both parent and subsidiary belong in our directory. It does not handle cases where the parent is a non-ITAD conglomerate (like SK Group, which owns SK Tes but isn't itself an ITAD vendor).

Add these two fields to `src/collections/Vendors.ts`, immediately after the existing `acquisition` group:

```typescript
// Add after the acquisition group, before claim_status

{
  name: 'parent_company_text',
  type: 'text',
  admin: {
    description:
      'For cases where the parent company is NOT in the Compare ITAD directory ' +
      '(e.g., a non-ITAD conglomerate parent like SK Group owning SK Tes). Use ' +
      'this instead of parent_company when the parent should not be a clickable ' +
      'directory link. If both fields are populated, parent_company (the ' +
      'relationship) takes precedence in the UI.',
    condition: (data) => !data.parent_company,
  },
},
{
  name: 'parent_company_text_notes',
  type: 'textarea',
  admin: {
    description:
      'Context for the parent_company_text relationship. Example: "SK Group is a ' +
      'South Korean industrial conglomerate; SK Tes is the ITAD operating unit ' +
      'following SK Ecoplant\'s acquisition of TES in 2022." This renders below ' +
      'the parent company name on the profile page.',
    condition: (data) => Boolean(data.parent_company_text),
  },
},
```

### Profile page UI treatment

On the vendor profile page, the rendering logic becomes:

1. **If `parent_company` (relationship) is set:** render "[Vendor X] is a subsidiary of [Parent Record Name — clickable link to parent's profile]" with the acquisition block as usual.

2. **Else if `parent_company_text` is set:** render "[Vendor X] is a subsidiary of [Parent Company Text — non-clickable]" followed by the `parent_company_text_notes` as an explanatory paragraph. No "View parent profile →" link.

3. **Else:** no parent block.

The mutually-exclusive admin condition (`!data.parent_company` on the text field, `!data.parent_company_text` effectively on the relationship via the UI component logic) prevents an editor from populating both. If both somehow exist, the relationship wins.

---

## 2. VendorCertifications collection — source_quote required

Currently the `source_quote` field on VendorCertifications exists in the Firecrawl prompt schema but isn't enforced at the Payload collection level. This is what's letting hallucinated certs (returned by the crawler without source quotes) land in the database.

Modify `src/collections/VendorCertifications.ts` to enforce provenance at write time:

```typescript
// Add this to the existing VendorCertifications collection fields array,
// ensuring source_quote is required

{
  name: 'source_quote',
  type: 'text',
  required: true,  // <-- NEW: previously optional or missing
  minLength: 10,   // <-- NEW: 10-char minimum prevents empty-ish values
  admin: {
    description:
      'Verbatim quote from the vendor\'s page making this certification claim. ' +
      'Required. A cert record without a source quote fails our provenance ' +
      'requirement and cannot be published. If you cannot find an explicit ' +
      'textual claim on the vendor\'s site, do not create the cert record — ' +
      'certifications inferred from logos or design cues alone are not self-reports.',
  },
  validate: (value: string | undefined) => {
    if (!value || value.trim().length < 10) {
      return 'source_quote is required and must be at least 10 characters. ' +
             'This field exists to enforce the provenance requirement published ' +
             'on /methodology. If no textual claim exists on the vendor site, ' +
             'do not create this certification record.'
    }
    return true
  },
},
```

This is defense in depth. The import script (item 3 below) catches the problem first; this catches it if anyone ever adds a cert via the Payload admin UI and tries to save without a source_quote.

---

## 3. Import script filter — drop certs without source_quote

In `scripts/import-vendors.ts`, add a pre-import filter to the cert-handling section. The script should currently iterate through each crawled dossier and insert cert records one by one; add validation immediately before each cert insert:

```typescript
// In scripts/import-vendors.ts, wherever certifications are iterated:

const droppedCerts: Array<{ slug: string; cert_type: string; reason: string }> = []

for (const cert of dossier.certifications) {
  // Validate provenance before import
  if (!cert.source_quote || cert.source_quote.trim().length < 10) {
    droppedCerts.push({
      slug: dossier.vendor.slug,
      cert_type: cert.type,
      reason: 'No source_quote — provenance requirement failed',
    })
    continue  // skip the insert
  }

  // Normalize cert type — drop items that aren't actual certifications
  if (!VALID_CERT_TYPES.includes(cert.type)) {
    droppedCerts.push({
      slug: dossier.vendor.slug,
      cert_type: cert.type,
      reason: `Type ${cert.type} is not a valid certification (likely regulatory framework or accrediting body)`,
    })
    continue
  }

  // ... proceed with import ...
}

// At end of run, write dropped certs to a report file
await fs.writeFile(
  'data/vendors/_reports/dropped-certs.tsv',
  'slug\tcert_type\treason\n' +
  droppedCerts.map(d => `${d.slug}\t${d.cert_type}\t${d.reason}`).join('\n')
)
```

Where `VALID_CERT_TYPES` is the authoritative enum from `src/lib/cert-types.ts` — just the ones that map cleanly to our schema. Items outside this list (HIPAA, FERPA as "certs"; IEEE, ANSSI, TÜV as "cert types"; regional regulatory approvals) get dropped to the report for editorial review.

The dropped-certs report is the editorial input for the next pass — editorial can review each skipped cert, manually verify the actual claim against the vendor website, and add the cert back via the Payload admin UI with a proper source_quote if appropriate.

---

## 4. Vendors collection — data_quality_flags group

This is the new field group that surfaces sparse-data and verification-pending states to readers. It's the UI equivalent of what the admin's `_meta.flags` array already captures in the JSON dossiers — but those are internal notes. This field group exposes the relevant subset to readers so they understand why a profile has less information than others, which is a neutrality commitment (we shouldn't silently ship sparse profiles as if they were complete).

Add this group to `src/collections/Vendors.ts` after the existing `provenance` group:

```typescript
{
  name: 'data_quality_flags',
  type: 'group',
  admin: {
    description:
      'Public-facing data quality context. These flags render in the ' +
      'provenance footer on the profile page so readers understand why ' +
      'a profile has less information than others.',
  },
  fields: [
    {
      name: 'sparse_data',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Check when the vendor\'s public website provides minimal self-reported ' +
          'data (e.g., OEM ITAD arms with marketing-heavy pages). Triggers a ' +
          'footer notice explaining why this profile is thinner than others.',
      },
    },
    {
      name: 'awaiting_re_verification',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Check when the profile\'s last_verified_at is older than 90 days ' +
          'or when editorial is aware of pending vendor changes. Triggers a ' +
          'footer notice that the profile is pending review.',
      },
    },
    {
      name: 'bot_protection_limited_crawl',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Check when the vendor\'s website uses aggressive bot protection that ' +
          'limited our automated crawl (e.g., Cloudflare challenges, Blue Star ' +
          'Recycling situation). Profile content is human-verified only. Triggers ' +
          'a footer notice that crawl was limited.',
      },
    },
    {
      name: 'editor_note',
      type: 'textarea',
      admin: {
        description:
          'Optional editor-written note that appears in the footer when any of ' +
          'the above flags are true. Example: "This profile reflects publicly ' +
          'available information from the vendor\'s corporate website. Extended ' +
          'service details were not available on the pages crawled."',
      },
    },
  ],
},
```

### Provenance footer rendering

Update `components/directory/ProvenanceFooter.tsx` to include a "Data quality" sub-section when any `data_quality_flags.*` checkbox is true:

```tsx
{(vendor.data_quality_flags?.sparse_data ||
  vendor.data_quality_flags?.awaiting_re_verification ||
  vendor.data_quality_flags?.bot_protection_limited_crawl) && (
  <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-4 text-amber-900">
    <p className="mb-2 font-medium">About the information on this page</p>
    <ul className="text-sm space-y-1 list-disc ml-4">
      {vendor.data_quality_flags.sparse_data && (
        <li>
          This vendor's public website provides limited self-reported data. The profile
          reflects what could be verified from publicly available sources.
        </li>
      )}
      {vendor.data_quality_flags.awaiting_re_verification && (
        <li>
          This profile is pending editorial re-verification. Information may be out of date.
        </li>
      )}
      {vendor.data_quality_flags.bot_protection_limited_crawl && (
        <li>
          This profile was compiled through manual review rather than automated crawling
          because the vendor's website restricts automated access.
        </li>
      )}
    </ul>
    {vendor.data_quality_flags.editor_note && (
      <p className="mt-2 text-sm">{vendor.data_quality_flags.editor_note}</p>
    )}
  </div>
)}
```

The amber-bordered box is deliberately less alarming than a red-bordered one — these profiles aren't wrong, they're just thinner, and the visual register should match that nuance.

---

## 5. Industries collection — no changes

The Industries collection from the original handoff is unchanged by this addendum.

---

## 6. Leads collection — no changes

The Leads collection from the original handoff is unchanged by this addendum.

---

## 7. Deployment steps

Execute in this order, with a smoke test between each step:

1. Apply the two new Vendors fields (`parent_company_text`, `parent_company_text_notes`). Smoke test: admin UI should show both fields, and the mutually-exclusive condition should hide `parent_company_text` when `parent_company` is set.

2. Apply the `source_quote` required/minLength change on VendorCertifications. Smoke test: attempting to save a cert with empty `source_quote` via the Payload admin UI should fail with the custom validate() message.

3. Apply the `data_quality_flags` group on Vendors. Smoke test: admin UI should show the four sub-fields; conditional `editor_note` should display when any checkbox is true.

4. Update `scripts/import-vendors.ts` with the dropped-certs filter. Smoke test: run `npm run import:vendors -- --dry-run` against the current dossier set; expect 30–40% of cert records to drop with the "no source_quote" reason. Inspect `_reports/dropped-certs.tsv` and confirm the drops look correct.

5. Update `components/directory/ProvenanceFooter.tsx` to render the data-quality notice. Smoke test: create a test vendor record with `sparse_data: true` and confirm the amber notice renders on the profile page.

After all five land, we're cleared to flip records to `is_published: true` per the plan in the previous admin response.
