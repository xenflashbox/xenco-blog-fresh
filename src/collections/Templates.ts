// src/collections/Templates.ts
//
// BlogCraft writing-templates collection.
//
// IMPORTANT — this collection is GLOBAL, not tenant-scoped. Unlike Articles /
// Categories / Tags it deliberately has NO `site` relationship field and NO
// beforeOperation site-injection hook. Templates are shared across all ~25
// sites. Do not copy the Articles tenant-scoping pattern into this file.
//
// Field names are intentionally snake_case to match the Neon `templates` table
// and the BlogCraft CSV contract. The afterChange hook ships `JSON.stringify(doc)`
// straight to api.blogcraft.app with no key mapping, so the wire format must line
// up with Neon's columns exactly. Keep this in sync with 01-api-server-endpoint-spec.md.
import type {
  CollectionConfig,
  CollectionBeforeChangeHook,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from 'payload'

const SYNC_SECRET = process.env.TEMPLATES_SYNC_SECRET
const API_SERVER_URL = process.env.BLOGCRAFT_API_URL || 'https://api.blogcraft.app'

/**
 * Lock the slug after creation. The slug is the canonical key shared with Neon
 * and BlogCraft's prompt registry; changing it would orphan the Neon row and
 * break BlogCraft's references. Editors must create a new template instead.
 */
const beforeChange: CollectionBeforeChangeHook = async ({ data, operation, originalDoc }) => {
  if (operation === 'update' && originalDoc && data.slug !== originalDoc.slug) {
    throw new Error(
      `Slug cannot be changed after creation (was "${originalDoc.slug}", attempted "${data.slug}"). ` +
        `Create a new template instead.`,
    )
  }
  return data
}

/**
 * Push every create/update to the BlogCraft API server, which mirrors the row
 * into Neon. Sync failure is logged loudly but never throws: the Payload save
 * already succeeded and we must not surface a 500 in the admin UI for a
 * downstream sync problem (Xenco production standard).
 */
const afterChange: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return doc

  if (!SYNC_SECRET) {
    req.payload.logger.error(
      '[templates-sync] TEMPLATES_SYNC_SECRET not set in environment — skipping sync to ' +
        'api.blogcraft.app. Template was saved in Payload but Neon will be out of sync.',
    )
    return doc
  }

  try {
    const response = await fetch(`${API_SERVER_URL}/internal/templates/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Secret': SYNC_SECRET,
      },
      body: JSON.stringify(doc),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      req.payload.logger.error(
        `[templates-sync] FAILED slug=${doc.slug} operation=${operation} ` +
          `status=${response.status} body=${errorBody}`,
      )
      // Do not throw — Payload save succeeded; Neon sync failure is logged for follow-up.
    } else {
      // Honour the loud-on-failure invariant: a 2xx with a non-JSON body
      // (misconfigured response, proxy injecting HTML) must not pass silently.
      let result: { operation?: string } | null = null
      try {
        result = await response.json()
      } catch (parseErr) {
        req.payload.logger.warn(
          `[templates-sync] WARN slug=${doc.slug} operation=${operation} ` +
            `status=${response.status} body_parse_failed=${
              parseErr instanceof Error ? parseErr.message : String(parseErr)
            }`,
        )
      }
      req.payload.logger.info(
        `[templates-sync] OK slug=${doc.slug} operation=${operation} ` +
          `remote_operation=${result?.operation ?? 'unknown'}`,
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    req.payload.logger.error(
      `[templates-sync] ERROR slug=${doc.slug} operation=${operation} error="${message}"`,
    )
  }

  return doc
}

/**
 * Mirror deletes to the API server so Neon drops the corresponding row.
 * Same loud-but-non-fatal logging policy as afterChange.
 */
const afterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (!SYNC_SECRET) {
    req.payload.logger.error(
      '[templates-sync] TEMPLATES_SYNC_SECRET not set — skipping delete sync',
    )
    return doc
  }

  try {
    const response = await fetch(`${API_SERVER_URL}/internal/templates/sync/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Secret': SYNC_SECRET,
      },
      body: JSON.stringify({ slug: doc.slug }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      req.payload.logger.error(
        `[templates-sync] DELETE FAILED slug=${doc.slug} status=${response.status} body=${errorBody}`,
      )
    } else {
      req.payload.logger.info(`[templates-sync] DELETE OK slug=${doc.slug}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    req.payload.logger.error(
      `[templates-sync] DELETE ERROR slug=${doc.slug} error="${message}"`,
    )
  }

  return doc
}

export const Templates: CollectionConfig = {
  slug: 'templates',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['slug', 'label', 'template_type', 'article_type', 'is_active'],
    description:
      'BlogCraft writing templates. Edits here sync automatically to api.blogcraft.app and ' +
      'from there into Neon. Do NOT edit templates directly in Neon — Payload is the source of truth.',
    group: 'Editorial System',
  },
  access: {
    // Templates are admin-managed. Any authenticated user (incl. API-key callers
    // such as BlogCraft) may read them; only admins can mutate.
    create: ({ req }) => req.user?.role === 'admin',
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'Template slug — must match BlogCraft’s prompt_key references. ' +
          'Example: pillar-comprehensive-guide. Locked after creation (see beforeChange hook).',
      },
    },
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable name, shown in admin UI dropdowns.',
      },
    },
    {
      name: 'template_type',
      type: 'select',
      required: true,
      options: [
        { label: 'Pillar', value: 'pillar' },
        { label: 'Spoke', value: 'spoke' },
        { label: 'Single Review', value: 'single_review' },
        { label: 'Vs Comparison', value: 'vs_comparison' },
        { label: 'Roundup Review', value: 'roundup_review' },
      ],
      admin: {
        description: 'High-level template family.',
      },
    },
    {
      name: 'article_type',
      type: 'text',
      required: true,
      admin: {
        description:
          'Specific article subtype. Examples: long_form_guide, listicle, how_to, explainer, ' +
          'buying_guide, product_review, service_review, product_comparison, alternatives_list, ' +
          'top_picks, best_of_roundup, supporting_article.',
      },
    },
    {
      name: 'article_intent',
      type: 'select',
      required: true,
      options: [
        { label: 'Informational', value: 'informational' },
        { label: 'Commercial', value: 'commercial' },
        { label: 'Transactional', value: 'transactional' },
      ],
    },
    {
      name: 'prompt_key',
      type: 'text',
      required: true,
      admin: {
        description:
          'Key referenced by BlogCraft’s prompt registry. Must match an existing entry in ' +
          'BlogCraft. Do not change without coordinating with BlogCraft prompt updates.',
      },
    },
    {
      name: 'outline_version',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 1,
      admin: {
        description:
          'Increment when changing required_sections or copy_primitives. ' +
          'Helps track template evolution.',
      },
    },
    {
      name: 'copy_primitives',
      type: 'json',
      required: true,
      admin: {
        description:
          'Array of block primitives BlogCraft uses for this template. ' +
          'Example: ["authority_hook", "stat_proof", "expert_quote"]. ' +
          'Must be valid JSON array of strings.',
      },
      validate: (value: unknown) => {
        if (!Array.isArray(value)) return 'copy_primitives must be an array'
        if (!value.every((v) => typeof v === 'string')) return 'all copy_primitives must be strings'
        if (value.length === 0) return 'at least one primitive required'
        return true
      },
    },
    {
      name: 'required_sections',
      type: 'json',
      required: true,
      admin: {
        description:
          'Array of required article sections. ' +
          'Example: ["introduction", "table_of_contents", "what_is", "faq", "conclusion"]. ' +
          'Must be valid JSON array of strings.',
      },
      validate: (value: unknown) => {
        if (!Array.isArray(value)) return 'required_sections must be an array'
        if (!value.every((v) => typeof v === 'string')) return 'all required_sections must be strings'
        if (value.length === 0) return 'at least one section required'
        return true
      },
    },
    {
      name: 'template_json',
      type: 'json',
      required: true,
      admin: {
        description:
          'Template configuration object. Includes tone, seo_notes, cta_placement, heading_depth, ' +
          'word_count_range, media_suggestions, internal_link_density, optional schema_markup and ' +
          'is_listicle.',
      },
      validate: (value: unknown) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
          return 'template_json must be an object'
        return true
      },
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Active templates are eligible for BlogCraft to write to. Inactive templates remain in ' +
          'storage but won’t be selected for new articles.',
        position: 'sidebar',
      },
    },
    {
      name: 'data_required',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'True for templates that need structured data inputs (e.g. compared_products, ' +
          'roundup_items). BlogCraft validates against payload_schema before writing.',
        position: 'sidebar',
      },
    },
    {
      name: 'payload_schema',
      type: 'json',
      admin: {
        description:
          'JSON Schema (draft-07) describing required data inputs when data_required is true. ' +
          'Used by BlogCraft to validate incoming research data.',
        condition: (data) => data?.data_required === true,
      },
    },
    {
      name: 'data_required_message',
      type: 'textarea',
      admin: {
        description:
          'Human-readable message shown when data is missing. Example: “Product review ' +
          'templates require a review_subject with name + vendor + url + specs.”',
        condition: (data) => data?.data_required === true,
      },
    },
  ],
  hooks: {
    beforeChange: [beforeChange],
    afterChange: [afterChange],
    afterDelete: [afterDelete],
  },
}
