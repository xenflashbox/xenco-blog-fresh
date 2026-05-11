# Payload Admin — Phase A Deployment Brief

**For:** Payload CMS Admin (the operator with write access to the `payload-swarm_payload` Docker swarm service)
**From:** Compare ITAD frontend team
**Status:** Hard blocker for vendor directory launch — frontend cannot fetch real data until this is deployed
**Estimated effort:** 3–5 hours (collection definitions + schema migration + seed + smoke test)

---

## What we need from you

Six new Payload collections plus a schema addendum, deployed to the `compareitad` site/tenant on the live Payload instance, then a smoke test confirming our frontend's existing `CMS_API_KEY` can read and write against them.

We've validated end-to-end that:

1. The frontend code is wired up against `CMS_URL=https://payload.example.com` and `CMS_API_KEY=<our key>` from `.env.local`
2. The frontend calls fail today with `404 Route not found` because none of the six collections exist on your instance
3. We have 41 vendor JSON dossiers ready to import (in `data/vendors/*.json`) the moment the collections accept POST requests

We will **not** touch your Payload codebase or Docker swarm directly. You own the deployment; we own the data import that follows.

---

## Why we cannot deploy this ourselves

- The Payload source lives in a separate repo we don't have write access to.
- Your instance runs as a pre-built Docker image in `payload-swarm`. A schema mistake on our side would risk taking down the entire blog/CMS architecture.
- Collection deploy + index migrations on a production Payload instance with live traffic is your operational domain.

So we're handing you the full spec below and waiting for your confirmation before we run the import.

---

## Source of truth for the schemas

The complete TypeScript collection definitions for all six collections are in:

`docs/compareITAD-admin-handoff.md` — section 2 (Vendors, VendorCertifications, VendorFacilities, VendorServices, Industries, Leads)

The schema addendum (subsidiary fields) is in:

`docs/compareITAD-vendor-crawl-roster.md` — section 3 (`parent_company` relationship + `acquisition` group)

**Use those documents as the canonical spec.** The summaries below are for orientation; the actual TypeScript blocks in the linked docs are what you should copy into your `src/collections/` directory.

---

## Collections to create (six total)

| File path | Slug | Purpose | Key constraints |
|---|---|---|---|
| `src/collections/Vendors.ts` | `vendors` | One record per ITAD vendor | Unique `slug` (indexed); requires `parent_company` (relationship → vendors) and nested `acquisition` group from the addendum |
| `src/collections/VendorCertifications.ts` | `vendor-certifications` | One row per cert held by a vendor | `vendor` (relationship → vendors), `verification_status` enum (`self-reported` / `verified` / `expired` / `unverifiable`) |
| `src/collections/VendorFacilities.ts` | `vendor-facilities` | One row per physical facility | `vendor` (relationship → vendors), city/state/country, `ownership` enum |
| `src/collections/VendorServices.ts` | `vendor-services` | One row per service offered | `vendor` (relationship → vendors), `service_type` enum |
| `src/collections/Industries.ts` | `industries` | Lookup table for industry verticals | Unique `slug`, `display_name` |
| `src/collections/Leads.ts` | `leads` | Inbound consultation/contact requests | `vendor` (optional relationship → vendors), basic contact fields, source attribution |

All collections must:

- Use the `citad_` Neon table prefix (e.g., `citad_vendors`, `citad_vendor_certifications`).
- Allow public **read** access (`access.read: () => true`).
- Restrict create/update/delete to authenticated users (`Boolean(user)`).
- Include `useAsTitle` and a sensible `defaultColumns` set so the admin UI is usable.

---

## Vendors — extra detail (this is the big one)

The `Vendors` collection has the most fields. Highlights you should not miss:

- **`slug`** — unique, indexed, required. We use this for URL routing (`/directory/{slug}`).
- **`is_published`** — boolean, defaults to `false`. Nothing renders on the frontend until this is `true`.
- **`provenance`** — a group with `primary_source_url`, `crawled_at`, `last_verified_at`, `crawler_version`, `verification_notes`. We populate `crawled_at` and `primary_source_url` from the Firecrawl run; you populate `last_verified_at` after editorial review.
- **`claim_status`** — enum (`unclaimed` / `pending-claim` / `claimed`). Default `unclaimed`.
- **NEW: `parent_company`** — relationship to `vendors`. Wired up so a Wisetek record can point at the Iron Mountain record.
- **NEW: `acquisition`** — group, conditional on `parent_company` being set. Holds `acquired_date`, `announcement_url`, `subsidiary_status` (`operating-as-brand` / `merged-into-parent` / `winding-down`), `acquired_entity_notes`.

The verbatim TypeScript for the addendum is in `docs/compareITAD-vendor-crawl-roster.md` section 3 — **paste those two field groups in immediately after the existing `provenance` group and before the `claim_status` group** in `Vendors.ts`.

---

## Industries — seed data (15 rows)

Once the `industries` collection is live, seed it with the 15 rows defined in `docs/compareITAD-admin-handoff.md` section 2.5. The slugs we depend on are:

```
healthcare, financial-services, government-federal, government-state-local,
education-k12, education-higher-ed, technology, manufacturing, retail,
legal, energy-utilities, telecommunications, defense, transportation, nonprofit
```

Our vendor dossiers reference these slugs in `industries_served[]`. If any slug differs, our import will silently drop those associations, so please use the exact strings above.

---

## Acceptance test — what we need before we start importing

Please confirm the following by running these `curl` commands from any machine that can reach the Payload instance, using the Compare ITAD API key:

```bash
# 1. List collections — should include all six new slugs
curl -H "Authorization: <api-key-scheme> $CMS_API_KEY" \
  "$CMS_URL/api/vendors?limit=1"

curl -H "Authorization: <api-key-scheme> $CMS_API_KEY" \
  "$CMS_URL/api/vendor-certifications?limit=1"

curl -H "Authorization: <api-key-scheme> $CMS_API_KEY" \
  "$CMS_URL/api/vendor-facilities?limit=1"

curl -H "Authorization: <api-key-scheme> $CMS_API_KEY" \
  "$CMS_URL/api/vendor-services?limit=1"

curl -H "Authorization: <api-key-scheme> $CMS_API_KEY" \
  "$CMS_URL/api/industries?limit=20"   # should return 15 rows after seeding

curl -H "Authorization: <api-key-scheme> $CMS_API_KEY" \
  "$CMS_URL/api/leads?limit=1"

# 2. Smoke-test create on vendors (we'll roll this back)
curl -X POST -H "Authorization: <api-key-scheme> $CMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug":"smoke-test-delete-me","name":"Smoke Test","website":"https://example.com","is_published":false}' \
  "$CMS_URL/api/vendors"

# 3. Confirm the parent_company field is present in the response
curl -H "Authorization: <api-key-scheme> $CMS_API_KEY" \
  "$CMS_URL/api/vendors?where[slug][equals]=smoke-test-delete-me"
# response.docs[0] should include parent_company: null and acquisition: {}

# 4. Delete the smoke-test row
curl -X DELETE -H "Authorization: <api-key-scheme> $CMS_API_KEY" \
  "$CMS_URL/api/vendors/<id-from-previous-response>"
```

When all of those return 200 with the expected payloads, we're unblocked.

---

## What we will do after you finish

1. Run `pnpm tsx scripts/import-vendors.ts` from this repo. This script reads all 41 dossiers in `data/vendors/*.json` and POSTs them as **unpublished** vendor records (`is_published: false`).
2. Walk through the post-crawl verification workflow in `docs/compareITAD-vendor-crawl-roster.md` section 6: cross-reference each cert against SERI/i-SIGMA/e-Stewards registries, then set `verification_status: 'verified'` per row.
3. Wire up the 5 known subsidiary relationships (ITRenew/Wisetek/Regency → Iron Mountain, Cascade → Sage) by setting the `parent_company` field on those subsidiary records.
4. Flip `is_published: true` on each record after editorial review.
5. Run a final smoke test of `/directory` and the subsidiary notice block on `/directory/wisetek`.

We expect roughly 1–2 days of editorial work for steps 2–4. None of it requires Payload-admin involvement after the collections exist.

---

## What we found during the crawl that may affect your priorities

We ran `firecrawl_scrape` on all 41 vendor URLs while waiting on this brief. A few items surfaced that are worth knowing before you sit down to deploy:

- **3 false inclusions** in the original roster: `humanitechnology.com` (prosthetics), `epc-group.net` (Microsoft consulting), and one ambiguous Cohen page. These may need to be removed from the roster (we've flagged them with `FALSE_INCLUSION_NOT_ITAD` in the dossiers).
- **2 dead/redirected domains**: `lifespan-tech.com` (DNS dead) and `dataserv-group.com` (redirects to SK Tes). These suggest undocumented acquisitions or company shutdowns since the roster was compiled.
- **3 OEM ITAD URLs needing editorial fix** before publishing: Dell (works), HPE (URL needs `it-` prefix), IBM (redirected to generic /services), Arrow (404).
- **5 known subsidiary relationships** to wire after collections exist (ITRenew, Wisetek, Regency → Iron Mountain; Cascade → Sage; SK Tes detected SK Group as parent but should NOT be a directory relationship since SK Group is not an ITAD vendor).

Full per-vendor details are in `data/vendors/_reports/findings.md` (we'll generate this in the next step).

---

## Communication

When you're done, reply with:

1. The Git SHA / image tag you deployed
2. The output of the 6 acceptance-test curls above
3. Any deviations from the spec (collection field names, validation rules, etc.) so our import script can adjust

We'll then run the import and confirm the directory page renders 41 unpublished vendor records on staging.

Thanks — this unblocks everything downstream.
