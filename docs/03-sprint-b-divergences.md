# Sprint B — Divergences & Reconciliation Notes

Record of every place the Payload registration (this PR) differs from, or clarifies,
`docs/01-block-system-v2-spec.md` and `docs/03-sprint-b-payload-admin.md`. Sprint A
(front-end `@xenco/editorial-blocks`) should reconcile against this list.

Per the spec's own rule (§ "Coordination with Sprint A"): divergences are fixed at
the spec, not by one side accommodating. These are flagged for that purpose.

---

## 1. 22 conceptual block types → 37 registered blocks (variant expansion)

The spec §4 catalogs **22 block types**. This PR registers **37 Lexical blocks**
because preset variants need distinct slash-menu entries for editor UX.

**Front-end impact: 22 React components are enough.** The variant blocks resolve to
the same component with a preset prop. Mapping:

| Registered block (slug)   | Resolves to component | Preset prop          |
| ------------------------- | --------------------- | -------------------- |
| `callout`                 | `Callout`             | (variant from field) |
| `tip-callout`             | `Callout`             | `variant="info"`     |
| `warning-callout`         | `Callout`             | `variant="warning"`  |
| `ranking-badge`           | `RankingBadge`        | (variant from field) |
| `category-badge`          | `CategoryBadge`       | —                    |

All other 32 slugs map 1:1 to a component. So: **37 slash-menu entries, 22 (±) React
components.** `tip-callout`/`warning-callout` are the two true alias expansions of
`callout`; the remaining count difference is the spec grouping related blocks under one
heading while each is its own registered block (e.g. the data-density and list-and-rank
families).

The full 37-slug list in registration order is in `src/lexical/editorial-blocks.ts`
(`editorialBlocks`).

---

## 2. `top_takeaways` minRows: spec says 3, this PR uses 0  ⚠️ PRODUCTION SAFETY

- **Spec §6.1**: `top_takeaways` array with `minRows: 3, maxRows: 5`.
- **This PR**: `minRows: 0, maxRows: 5`.

**Why:** ~25 production sites have existing articles with **zero** takeaways. With
`minRows: 3`, the next time an editor opens and saves any legacy article, Payload would
**reject the save** (demanding 3+ rows) — breaking routine editing across all sites.
This is the same legacy-safety class as PR #3's `template: required = false`.

`maxRows: 5` is preserved (the editorial ceiling). The "3-5 bullets" expectation still
holds for **new templated** articles — it's enforced editorially / by BlogCraft, not by
a hard collection constraint that also catches legacy rows.

**Reconciliation:** recommend updating spec §6.1 to `minRows: 0` with a note that the
3-bullet minimum is a templated-article convention, not a schema constraint.

---

## 3. Block storage: NO `articles_blocks_*` tables (migration scope)

The Sprint B prompt (Task 4) expected the migration to create "dozens of
`articles_blocks_*` tables." It does **not**, and that is correct:

Lexical `BlocksFeature` blocks are stored as nodes **inside the `articles.content`
richText JSONB column**, not as relational tables. Only **top-level** array/blocks
fields on a collection get child tables. So the migration creates exactly two tables —
`articles_top_takeaways` and `articles_footer_sources` — for the two new top-level
array fields. The 37 blocks need no schema change.

No action for Sprint A; recorded so the small migration isn't mistaken for incomplete.

---

## 4. richText field name is `content`, not `body`

The Sprint B prompt Tasks 2–3 referred to the Articles richText field as `body`. The
actual field (since before this sprint) is **`content`**. `BlocksFeature` was registered
on `content`, preserving its existing custom editor config (the upload/list feature
filter + `UploadFeature` with caption). No `body` field exists or was created.

---

*Generated as part of feat/editorial-blocks-lexical-registration.*
