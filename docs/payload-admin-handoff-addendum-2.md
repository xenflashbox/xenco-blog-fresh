# Payload Admin Handoff — Schema Addendum 2 Deployment

**Audience:** Payload CMS backend admin (owner of `cms.compareitad.com`)
**Scope:** Deploy the three collection-level schema changes specified in `docs/schema-addendum-2.md` that are currently blocking correct rendering of vendor profiles on the Compare ITAD production directory.
**Estimated effort:** 1 developer-day total across all three changes.
**Blocker status:** This work is on the critical path. The front-end admin has already deployed the UI and import-script changes that depend on these fields. The data is staged and waiting — the field definitions are the only missing piece.

---

## 1. Current state — what's deployed, what's missing

### Already shipped (front-end admin, commit `75b5cf3` on `main`)

- `scripts/import-vendors.ts` — cert-hallucination filter drops certs without `source_quote` of 10+ characters. Already executed against live data and purged 65 fake cert records.
- `scripts/cleanup-and-relink.mjs` — orchestrator that PATCHes `parent_company_text`, `parent_company_text_notes`, and `data_quality_flags` values to vendor records. **PATCHes succeed with 200 OK, but Payload silently drops unknown fields, so the values are not persisting.**
- `components/directory/ProvenanceFooter.tsx` — amber-bordered "About the information on this page" notice block that conditionally renders based on `data_quality_flags` values. **Currently renders empty because it has no data to read.**
- `lib/types.ts` + `lib/payload-vendors.ts` — TypeScript types and transform layer extended for the new fields. Frontend is ready the moment the backend provides the data.

### Pending (your work — this document)

Three schema changes specified in detail in `docs/schema-addendum-2.md` sections 1, 2, and 4. Summary table:

| # | Collection | Change | Purpose |
|---|---|---|---|
| 1 | Vendors | Add `parent_company_text` + `parent_company_text_notes` fields | Handle non-directory parent companies like SK Group (parent of SK Tes) that should not be clickable links |
| 2 | VendorCertifications | Make `source_quote` required with `minLength: 10` | Prevent hallucinated cert records from ever being saved via the admin UI (defense in depth; import filter already catches API-side) |
| 3 | Vendors | Add `data_quality_flags` group (sparse_data, awaiting_re_verification, bot_protection_limited_crawl, editor_note) | Surface data-quality context to readers in the provenance footer for thin/bot-blocked profiles |

### Currently waiting in the database

When you deploy #1 and #3, re-running `node scripts/cleanup-and-relink.mjs --execute` on the admin side will populate these queued values in a single pass (the script is idempotent):

- **SK Tes** → `parent_company_text: "SK Group"` + notes explaining the non-ITAD conglomerate parent
- **8 vendors** with `sparse_data: true` (thin self-reported data — OEMs and small sites)
- **1 vendor** (`bluestarr`) with `bot_protection_limited_crawl: true` + `awaiting_re_verification: true`
- **Editor notes** on profiles that need reader-facing context

None of this data will render on the public site until the field definitions exist in Payload.

---

## 2. The three changes — what to implement

**Full specifications** with field-level details, validation rules, admin UI descriptions, and acceptance tests live in `docs/schema-addendum-2.md`. This document is the execution guide; the spec document is the source of truth if any detail is unclear.

### Change 1: `parent_company_text` + `parent_company_text_notes` on Vendors

**File to modify:** `src/collections/Vendors.ts`

**Where to add:** Immediately after the existing `acquisition` group, before `claim_status`.

**What to add:** Two fields per `docs/schema-addendum-2.md` section 1:

- `parent_company_text` (type: `text`) — displays only when `parent_company` (the relationship field) is not set. Used for non-ITAD conglomerate parents like SK Group.
- `parent_company_text_notes` (type: `textarea`) — conditional description that renders below the parent company name.

**Mutually exclusive with the existing `parent_company` relationship field.** When both are populated, the relationship wins in the UI. The `admin.condition` on `parent_company_text` (`!data.parent_company`) hides the text field when a relationship is already set.

**Acceptance test:**

```bash
# After deploying:
curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/vendors?where[slug][equals]=sk-tes&select=slug,parent_company_text,parent_company_text_notes"
# Before re-run: empty parent_company_text, empty parent_company_text_notes
# After admin re-runs cleanup-and-relink.mjs: should return "SK Group" and the notes

# Admin UI test: open any vendor without a parent_company relationship set
# → the parent_company_text field should be visible
# Open Iron Mountain (which has subsidiaries via parent_company relationships)
# → the parent_company_text field should be hidden on the child records
```

### Change 2: `source_quote` required on VendorCertifications

**File to modify:** `src/collections/VendorCertifications.ts`

**What to change:** The existing `source_quote` field should become required with a 10-character minimum plus a custom validate function that rejects values under 10 characters with a specific error message. Full field spec in `docs/schema-addendum-2.md` section 2.

**Why:** The front-end admin's import script already enforces this at the API write boundary — 65 hallucinated cert records were dropped during the last import pass because they had no `source_quote`. But an editor creating a cert through the Payload admin UI can currently bypass this. Defense in depth: enforce it at the collection level so the policy is impossible to violate regardless of entry path.

**Acceptance test:**

```bash
# Try to create a cert via API without a source_quote — should fail with 400
curl -X POST -H "Authorization: Bearer ${CMS_API_KEY}" \
  -H "Content-Type: application/json" \
  "https://cms.compareitad.com/api/vendor-certifications" \
  -d '{"vendor": 33, "certification_name": "R2v3", "certification_body": "SERI"}'
# Expected: 400, error message about source_quote being required

# Admin UI test: try to save a cert with an empty or <10-char source_quote
# → save should fail with the validate() error message
```

### Change 3: `data_quality_flags` group on Vendors

**File to modify:** `src/collections/Vendors.ts`

**Where to add:** After the existing `provenance` group.

**What to add:** A group containing four fields per `docs/schema-addendum-2.md` section 4:

- `sparse_data` (checkbox, default false)
- `awaiting_re_verification` (checkbox, default false)
- `bot_protection_limited_crawl` (checkbox, default false)
- `editor_note` (textarea, optional explanatory text shown in the footer)

**Why:** These flags feed the ProvenanceFooter component already deployed on the front-end. When any flag is true, an amber-bordered notice renders on the profile page explaining why the data is thinner or why the profile is bot-protected.

**Acceptance test:**

```bash
# After deploying:
curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/vendors?where[slug][equals]=blue-star-recycling&select=slug,data_quality_flags"
# Before re-run: null or empty
# After admin re-runs cleanup-and-relink.mjs: should return
#   { "bot_protection_limited_crawl": true, "awaiting_re_verification": true, ... }

# Admin UI test: open any vendor record
# → the data_quality_flags group should appear in the admin form with four sub-fields
# → checking any flag and saving should persist
```

---

## 3. Deployment procedure

The Payload admin deployment pattern is whatever is standard for this CMS instance (Docker swarm service `payload-swarm_payload` based on previous handoffs). Typical sequence:

1. Pull the latest `src/collections/` changes into the local branch
2. Run `payload generate:types` to update the TypeScript types
3. Run any migrations the change triggers (Payload auto-generates migrations for schema changes on most databases)
4. Deploy to `cms.compareitad.com`
5. Run the three acceptance curls above to confirm the fields exist and validation works
6. Notify the front-end admin (via commit comment, Slack, or however you coordinate) so they can re-run `node scripts/cleanup-and-relink.mjs --execute`

---

## 4. Post-deployment verification

Once all three changes are live, the front-end admin will re-run `scripts/cleanup-and-relink.mjs --execute`. After that run completes:

**GET `/api/vendors?where[slug][equals]=sk-tes`** should include:
```json
{
  "parent_company_text": "SK Group",
  "parent_company_text_notes": "SK Group is a South Korean industrial conglomerate..."
}
```

**GET `/api/vendors?where[data_quality_flags.sparse_data][equals]=true`** should return the ~8 thin-data profiles.

**GET `/api/vendors?where[data_quality_flags.bot_protection_limited_crawl][equals]=true`** should return `blue-star-recycling` (and any others with the flag set).

**Public site verification** — visit a few profiles with data quality flags set and confirm the amber notice box renders correctly in the provenance footer.

---

## 5. What's NOT in scope for this deployment

These remain on the critical path but are separate workstreams:

- **Editorial cert registry verification** — cross-referencing 48 remaining certs against SERI / i-SIGMA / e-Stewards registries. Parked for editorial.
- **Publishing the other 25 vendor records** — gated on editorial review and on addendum-2 deployment (this document), plus editorial sign-off on sparse-data profiles.
- **Phase 2 vendor recovery** — re-adding `arrow-electronics`, `ibm-gars`, `ingram-micro-itad`, `hpe-asset-recovery` once fresh URLs are located. Editorial research task.
- **Any front-end / import / transform-layer changes** — those are already shipped in commit `75b5cf3` on `main`.

---

## 6. Questions or blockers

If any of the three changes reveals unexpected schema conflict, migration failure, or interaction with an undocumented Payload plugin, stop and surface it to Xen before improvising. The frontend and import scripts are already committed against the field shapes specified in `docs/schema-addendum-2.md` — changes to those shapes need coordination, not unilateral adjustment.

**Primary reference documents (read these if anything in this handoff is ambiguous):**

- `docs/schema-addendum-2.md` — authoritative spec with field definitions, validation rules, and admin UI treatment
- `docs/compareITAD-admin-handoff.md` — original Phase 1 collection schemas (what the three addendum-2 changes extend)
- `docs/compareITAD-vendor-crawl-roster.md` — vendor data model context

**When complete:** confirm to Xen with the three acceptance-test curl outputs pasted, and a screenshot of the admin UI showing the new fields on the Vendors collection form.
